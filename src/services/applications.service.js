const db = require("../config/database");
const { NotFoundError, ValidationError } = require("../utils/errors");
const { canTransition, getNextStatuses } = require("../utils/statusMachine");
const logger = require("../utils/logger");

/*
 * Creates a new job application and logs the initial status event.
 *
 * userId - who owns this application (comes from auth in Phase 2)
 * data   - validated fields like { company, role, status, ... }
 *
 * We also insert an event into application_events because every
 * status change needs a paper trail. Even the first one.
 * Think of it like: "Application was born with status 'wishlist'."
 */
async function createApplication(userId, data) {
  // Spread data + attach the owner. This produces one flat object:
  // { company: "Google", role: "Junior Dev", ..., user_id: "abc-123" }
  const [application] = await db("applications")
    .insert({ ...data, user_id: userId })
    .returning("*"); // .returning("*") gives us back the full row including the generated id

  // Log the "birth" event. from_status is null because it didn't exist before.
  await db("application_events").insert({
    application_id: application.id,
    from_status: null,
    to_status: application.status,
    notes: "Application created",
  });

  // Structured log - not console.log. In production one can search
  // "show me all creates for Google" by filtering on company field.
  logger.info(
    { userId, applicationId: application.id, company: data.company },
    "Application created"
  );

  return application;
}

/*
 * Fetches a single application by its id.
 *
 * The WHERE clause checks BOTH id and user_id. This is how we prevent
 * User A from viewing User B's applications. Even if someone guesses
 * another application's UUID, the user_id check blocks them.
 *
 * We also attach available_transitions so the client knows what
 * status changes are possible. For example, if status is "applied",
 * the client gets ["phone_screen", "rejected", "withdrawn"] and
 * can show only those buttons.
 */
async function getApplication(userId, applicationId) {
  // .first() returns a single object or undefined (not an array)
  const application = await db("applications")
    .where({ id: applicationId, user_id: userId })
    .first();

  if (!application) {
    throw new NotFoundError("Application not found");
  }

  // "From where you are now, here's where you can go next"
  application.available_transitions = getNextStatuses(application.status);

  return application;
}

/*
 * Lists applications with filtering, sorting, and pagination.
 *
 * FILTERING: "Show me only applications with status 'applied'"
 * SORTING:   "Show me newest first" or "sort by company A-Z"
 * PAGINATION: "Show me page 2, with 20 results per page"
 *
 * Without pagination, 500 applications = one massive response.
 * Without filtering, users have to scroll through everything.
 * Without sorting, results come back in whatever order Postgres feels like.
 *
 * All params have defaults set by the Zod schema, so nothing here is undefined.
 */
async function listApplications(userId, { page, per_page, status, company, sort, order }) {
  // Base query - always scoped to this user, always.
  const query = db("applications").where({ user_id: userId });

  // Only add filters that the user actually sent.
  // No status param? Don't filter by status. Show all.
  if (status) {
    query.andWhere({ status });
  }
  if (company) {
    // ILIKE = case-insensitive search. % = wildcard.
    // So "google" matches "Google", "Google LLC", "GOOGLE INC"
    query.andWhere("company", "ilike", `%${company}%`);
  }

  // We need the total count to tell the client "there are 47 results across 3 pages."
  // .clone() makes a copy because running .count() would consume the query builder.
  // Without clone, the data query below would break, the builder would already be "used up."
  // Postgres returns count as a string, so parseInt converts "47" to 47.
  const [{ count }] = await query.clone().count();
  const total = parseInt(count, 10);

  // Now get the actual rows.
  // .orderBy(sort, order) → ORDER BY created_at DESC
  // .limit(per_page)      → LIMIT 20
  // .offset(...)          → OFFSET 0 for page 1, OFFSET 20 for page 2, etc.
  // Formula: offset = (page - 1) * per_page
  const applications = await query
    .orderBy(sort, order)
    .limit(per_page)
    .offset((page - 1) * per_page)
    .select("*");

  // Return data + pagination metadata so the client can render
  // "Showing page 1 of 3 (47 total results)"
  return {
    data: applications,
    pagination: {
      page,
      per_page,
      total,
      total_pages: Math.ceil(total / per_page), // 47 / 20 = 2.35 → rounds up to 3
    },
  };
}

/*
 * Updates an application's fields (NOT status, that has its own function).
 *
 * Why check-then-update instead of just updating blindly?
 * If we skip the check and run UPDATE with a wrong id, Postgres returns
 * 0 rows updated and we'd send back an empty response. The user would
 * have no idea what went wrong. By checking first, we can throw a clear
 * "Application not found" error.
 *
 * db.fn.now() tells Postgres to use its own clock for the timestamp.
 * This is better than new Date() from Node because your server clock
 * and database clock might differ, and Postgres timestamps are the
 * source of truth.
 */
async function updateApplication(userId, applicationId, data) {
  const existing = await db("applications")
    .where({ id: applicationId, user_id: userId })
    .first();

  if (!existing) {
    throw new NotFoundError("Application not found");
  }

  // ...data spreads only the fields the user sent (Zod stripped everything else).
  // So if they only sent { notes: "Great interview" }, only notes gets updated.
  const [updated] = await db("applications")
    .where({ id: applicationId, user_id: userId })
    .update({
      ...data,
      updated_at: db.fn.now(),
    })
    .returning("*");

  // Log which fields changed — useful for debugging
  // "Application updated, fields: ['notes', 'salary_min']"
  logger.info(
    { userId, applicationId, fields: Object.keys(data) },
    "Application updated"
  );

  return updated;
}

/*
 * Transitions an application's status using the state machine.
 *
 * This is separate from updateApplication on purpose. Changing status
 * is NOT the same as editing a field. Status changes have rules:
 * - You can't go from "wishlist" to "offer" (skipping steps)
 * - You can't leave "rejected" (it's a dead end)
 * - Every transition must be logged in application_events
 *
 * We use a TRANSACTION here because two things must happen together:
 * 1. Update the status in the applications table
 * 2. Log the transition in application_events
 *
 * If #1 succeeds but #2 fails (say the database crashes mid-way),
 * we'd have a status change with no audit trail. A transaction says
 * "either both succeed, or neither happens." It's all-or-nothing.
 *
 * Inside the transaction, we use trx('table') instead of db('table').
 * trx is a special connection that groups everything into one atomic operation.
 */
async function transitionStatus(userId, applicationId, { status: newStatus, notes }) {
  // { status: newStatus } renames status to newStatus to avoid confusion
  // with the application's current status we're about to fetch.
  const application = await db("applications")
    .where({ id: applicationId, user_id: userId })
    .first();

  if (!application) {
    throw new NotFoundError("Application not found");
  }

  // The state machine says: "From 'wishlist', you can only go to 'applied' or 'withdrawn'."
  // If someone tries wishlist → offer, this catches it.
  if (!canTransition(application.status, newStatus)) {
    throw new ValidationError(
      `Cannot transition from '${application.status}' to '${newStatus}'`,
      [{
        field: "status",
        message: `Valid transitions from '${application.status}': ${getNextStatuses(application.status).join(", ") || "none (terminal status)"}`,
      }]
    );
  }

  // All-or-nothing: update status + log event together
  const updated = await db.transaction(async (trx) => {
    const [app] = await trx("applications")
      .where({ id: applicationId })
      .update({
        status: newStatus,
        updated_at: trx.fn.now(),
      })
      .returning("*");

    await trx("application_events").insert({
      application_id: applicationId,
      from_status: application.status, // what it WAS
      to_status: newStatus,            // what it's becoming
      notes: notes || null,
    });

    return app;
  });

  // Log both sides of the transition for easy debugging
  // "Application status transitioned, from: wishlist, to: applied"
  logger.info(
    { userId, applicationId, from: application.status, to: newStatus },
    "Application status transitioned"
  );

  return updated;
}

/*
 * Deletes an application.
 *
 * The simplest function here. .del() returns how many rows were deleted.
 * If 0, it either doesn't exist or belongs to another user, either way,
 * "not found" is the right response. We don't tell them WHICH case it is
 * because that would leak information ("oh, that ID does exist, just not mine").
 *
 * We don't need to manually delete events, contacts, or reminders because
 * the migration set ON DELETE CASCADE on those foreign keys. Postgres
 * handles the cleanup automatically when the parent application is deleted.
 */
async function deleteApplication(userId, applicationId) {
  const deleted = await db("applications")
    .where({ id: applicationId, user_id: userId })
    .del();

  if (deleted === 0) {
    throw new NotFoundError("Application not found");
  }

  logger.info({ userId, applicationId }, "Application deleted");
}

/*
 * Gets the full timeline (event history) for an application.
 *
 * Returns every status change in chronological order so the user
 * can see the journey: created → applied → phone screen → rejected.
 * We verify ownership first — you can't view another user's timeline.
 */
async function getTimeline(userId, applicationId) {
  const application = await db("applications")
    .where({ id: applicationId, user_id: userId })
    .first();

  if (!application) {
    throw new NotFoundError("Application not found");
  }

  // Ordered by created_at ASC so events read like a story:
  // first this happened, then this, then this.
  const events = await db("application_events")
    .where({ application_id: applicationId })
    .orderBy("created_at", "asc")
    .select("*");

  return events;
}

module.exports = {
  createApplication,
  getApplication,
  listApplications,
  updateApplication,
  transitionStatus,
  deleteApplication,
  getTimeline
};