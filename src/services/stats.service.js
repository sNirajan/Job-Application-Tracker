const db = require("../config/database");
const { STATUSES } = require("../utils/statusMachine");

/*
 * Builds a dashboard overview: total applications, count per status,
 * and conversion rates between pipeline stages.
 *
 * This uses GROUP BY instead of fetching every row and counting
 * in JavaScript, we let PostgreSQL do the counting. Much faster
 * when you have thousands of applications.
 */
async function getOverview(userId) {
  // GROUP BY status gives us: [{ status: "applied", count: "18" }, ...]
  // Note: Postgres returns count as a string, so we'll need parseInt later
  const rows = await db("applications")
    .where({ user_id: userId })
    .groupBy("status")
    .select("status")
    .count("* as count");

  // Start with every status at 0, so statuses with no applications
  // still appear in the response. Without this, if you have zero
  // "offer" applications, "offer" just wouldn't show up at all.
  const byStatus = {};
  STATUSES.forEach((s) => {
    byStatus[s] = 0;
  });

  // Fill in the real counts from the query
  rows.forEach((row) => {
    byStatus[row.status] = parseInt(row.count, 10);
  });

  // Total is just all counts added up
  const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);

  // Conversion rates: "of everyone who reached stage X, what % moved past it?"
  // We count everyone who passed THROUGH a stage, not just those sitting at it.
  // Someone at "technical" also passed through "phone_screen", so they count.
  const passedPhoneScreen =
    byStatus.phone_screen +
    byStatus.technical +
    byStatus.onsite +
    byStatus.offer +
    byStatus.accepted;
  const passedTechnical =
    byStatus.technical + byStatus.onsite + byStatus.offer + byStatus.accepted;
  const passedOnsite = byStatus.onsite + byStatus.offer + byStatus.accepted;
  const passedOffer = byStatus.offer + byStatus.accepted;

  // Helper to avoid dividing by zero. If nobody applied, the rate is 0, not NaN.
  const rate = (numerator, denominator) =>
    denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;

  const conversionRates = {
    applied_to_phone_screen: rate(
      passedPhoneScreen,
      byStatus.applied + passedPhoneScreen,
    ),
    phone_screen_to_technical: rate(
      passedTechnical,
      byStatus.phone_screen + passedTechnical,
    ),
    technical_to_onsite: rate(passedOnsite, byStatus.technical + passedOnsite),
    onsite_to_offer: rate(passedOffer, byStatus.onsite + passedOffer),
  };

  return {
    total,
    by_status: byStatus,
    conversion_rates: conversionRates,
  };
}

/*
 * Returns application count per week, sorted chronologically.
 * Powers the "how active have I been?" trend line on a dashboard.
 *
 * DATE_TRUNC('week', created_at) rounds every timestamp down to
 * the Monday of that week. So March 25 (Wednesday) becomes March 23 (Monday).
 * Then GROUP BY groups all applications from the same week together.
 */

async function getWeekly(userId) {
  const rows = await db("applications")
    .where({ user_id: userId })
    .select(db.raw("DATE_TRUNC('week', created_at)::date as week"))
    .count("* as count")
    .groupBy("week")
    .orderBy("week", "asc");

  // Parse count strings to numbers
  return rows.map((row) => ({
    week: row.week,
    count: parseInt(row.count, 10),
  }));
}

module.exports = {
  getOverview,
  getWeekly,
};
