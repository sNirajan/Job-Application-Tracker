const { getAuthAgent, createApplication, useTestDatabase } = require("../helpers");

useTestDatabase();

const XRW = ["X-Requested-With", "XMLHttpRequest"];

describe("Contacts", () => {
  it("creates, lists, updates and deletes a contact", async () => {
    const agent = await getAuthAgent();
    const app = await createApplication(agent);
    const base = `/api/v1/applications/${app.id}/contacts`;

    const created = await agent
      .post(base)
      .set(...XRW)
      .send({ name: "Jane Recruiter", title: "Recruiter", email: "jane@google.com" });
    expect(created.status).toBe(201);
    expect(created.body.data.name).toBe("Jane Recruiter");

    const listed = await agent.get(base);
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);

    const contactId = created.body.data.id;
    const updated = await agent
      .patch(`${base}/${contactId}`)
      .set(...XRW)
      .send({ phone: "204-555-0100", title: null });
    expect(updated.status).toBe(200);
    expect(updated.body.data.phone).toBe("204-555-0100");
    expect(updated.body.data.title).toBeNull();

    const deleted = await agent.delete(`${base}/${contactId}`).set(...XRW);
    expect(deleted.status).toBe(204);

    const after = await agent.get(base);
    expect(after.body.data).toHaveLength(0);
  });

  it("rejects a contact without a name or with a bad email", async () => {
    const agent = await getAuthAgent();
    const app = await createApplication(agent);

    const res = await agent
      .post(`/api/v1/applications/${app.id}/contacts`)
      .set(...XRW)
      .send({ email: "not-an-email" });

    expect(res.status).toBe(422);
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(["name", "email"]));
  });

  it("does not let one user see another user's contacts", async () => {
    const owner = await getAuthAgent("owner@test.com");
    const app = await createApplication(owner);
    await owner
      .post(`/api/v1/applications/${app.id}/contacts`)
      .set(...XRW)
      .send({ name: "Private Person" });

    const intruder = await getAuthAgent("intruder@test.com");
    const res = await intruder.get(`/api/v1/applications/${app.id}/contacts`);

    expect(res.status).toBe(404);
  });

  it("returns 404 for a malformed id instead of a server error", async () => {
    const agent = await getAuthAgent();
    const res = await agent.get("/api/v1/applications/not-a-uuid/contacts");
    expect(res.status).toBe(404);
  });
});
