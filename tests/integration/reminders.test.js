const { db, getAuthAgent, createApplication, useTestDatabase } = require("../helpers");

useTestDatabase();

const XRW = ["X-Requested-With", "XMLHttpRequest"];

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

describe("Reminders", () => {
  it("creates a reminder and lists it across applications with company info", async () => {
    const agent = await getAuthAgent();
    const app = await createApplication(agent, { company: "Shopify" });

    const created = await agent
      .post(`/api/v1/applications/${app.id}/reminders`)
      .set(...XRW)
      .send({ remind_at: daysFromNow(3), note: "Email the recruiter" });
    expect(created.status).toBe(201);
    expect(created.body.data.completed_at).toBeNull();

    const open = await agent.get("/api/v1/reminders");
    expect(open.status).toBe(200);
    expect(open.body.data).toHaveLength(1);
    expect(open.body.data[0].company).toBe("Shopify");
  });

  it("marks a reminder done and moves it to the done list", async () => {
    const agent = await getAuthAgent();
    const app = await createApplication(agent);
    const created = await agent
      .post(`/api/v1/applications/${app.id}/reminders`)
      .set(...XRW)
      .send({ remind_at: daysFromNow(-1) });

    const done = await agent
      .patch(`/api/v1/reminders/${created.body.data.id}`)
      .set(...XRW)
      .send({ completed: true });
    expect(done.status).toBe(200);
    expect(done.body.data.completed_at).not.toBeNull();

    const open = await agent.get("/api/v1/reminders?status=open");
    expect(open.body.data).toHaveLength(0);
    const finished = await agent.get("/api/v1/reminders?status=done");
    expect(finished.body.data).toHaveLength(1);
  });

  it("rejects a reminder without a valid date", async () => {
    const agent = await getAuthAgent();
    const app = await createApplication(agent);

    const res = await agent
      .post(`/api/v1/applications/${app.id}/reminders`)
      .set(...XRW)
      .send({ remind_at: "next tuesday" });
    expect(res.status).toBe(422);
  });

  it("does not let another user complete or delete my reminder", async () => {
    const owner = await getAuthAgent("owner@test.com");
    const app = await createApplication(owner);
    const created = await owner
      .post(`/api/v1/applications/${app.id}/reminders`)
      .set(...XRW)
      .send({ remind_at: daysFromNow(1) });

    const intruder = await getAuthAgent("intruder@test.com");
    const id = created.body.data.id;

    const patch = await intruder.patch(`/api/v1/reminders/${id}`).set(...XRW).send({ completed: true });
    expect(patch.status).toBe(404);
    const del = await intruder.delete(`/api/v1/reminders/${id}`).set(...XRW);
    expect(del.status).toBe(404);
  });

  describe("GET /api/v1/reminders/follow-ups", () => {
    it("suggests active applications that have gone quiet", async () => {
      const agent = await getAuthAgent();
      const quiet = await createApplication(agent, { company: "Quiet Co", status: "applied" });
      await createApplication(agent, { company: "Fresh Co", status: "applied" });
      const wish = await createApplication(agent, { company: "Wish Co", status: "wishlist" });

      // Pretend nothing happened on these for 10 days
      await db("applications")
        .whereIn("id", [quiet.id, wish.id])
        .update({ updated_at: db.raw("NOW() - INTERVAL '10 days'") });

      const res = await agent.get("/api/v1/reminders/follow-ups?days=7");
      expect(res.status).toBe(200);
      expect(res.body.data.map((a) => a.company)).toEqual(["Quiet Co"]);
      expect(res.body.data[0].days_idle).toBeGreaterThanOrEqual(10);
    });

    it("stops suggesting an application once it has an open reminder", async () => {
      const agent = await getAuthAgent();
      const quiet = await createApplication(agent, { status: "applied" });
      await db("applications")
        .where({ id: quiet.id })
        .update({ updated_at: db.raw("NOW() - INTERVAL '10 days'") });

      await agent
        .post(`/api/v1/applications/${quiet.id}/reminders`)
        .set(...XRW)
        .send({ remind_at: daysFromNow(2) });

      const res = await agent.get("/api/v1/reminders/follow-ups");
      expect(res.body.data).toHaveLength(0);
    });
  });
});
