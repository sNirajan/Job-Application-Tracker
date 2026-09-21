const fs = require("fs");
const os = require("os");
const path = require("path");

// Keep test uploads out of the project folder. Must be set before the
// app (and its config) is loaded.
const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "job-tracker-uploads-"));
process.env.UPLOAD_DIR = uploadDir;
process.env.STORAGE_DRIVER = "local";

const { getAuthAgent, createApplication, useTestDatabase } = require("../helpers");

useTestDatabase();

// The database is wiped between tests, so wipe stored files too
beforeEach(() => {
  fs.rmSync(uploadDir, { recursive: true, force: true });
  fs.mkdirSync(uploadDir, { recursive: true });
});

afterAll(() => {
  fs.rmSync(uploadDir, { recursive: true, force: true });
});

const XRW = ["X-Requested-With", "XMLHttpRequest"];
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");

function countStoredFiles() {
  let count = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name));
      else count += 1;
    }
  };
  walk(uploadDir);
  return count;
}

describe("Documents", () => {
  it("uploads a PDF, lists it, downloads it and deletes it", async () => {
    const agent = await getAuthAgent();
    const app = await createApplication(agent);
    const base = `/api/v1/applications/${app.id}/documents`;

    const uploaded = await agent
      .post(base)
      .set(...XRW)
      .field("kind", "resume")
      .attach("file", PDF, { filename: "My Resume.pdf", contentType: "application/pdf" });
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.data).toMatchObject({
      kind: "resume",
      original_name: "My Resume.pdf",
      mime_type: "application/pdf",
      size_bytes: PDF.length,
    });
    // The storage location is internal and never sent to the client
    expect(uploaded.body.data).not.toHaveProperty("storage_key");

    const listed = await agent.get(base);
    expect(listed.body.data).toHaveLength(1);

    const docId = uploaded.body.data.id;
    const downloaded = await agent.get(`${base}/${docId}/download`).buffer(true);
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers["content-type"]).toBe("application/pdf");
    expect(downloaded.headers["content-disposition"]).toContain("My Resume.pdf");
    expect(Buffer.compare(downloaded.body, PDF)).toBe(0);

    const deleted = await agent.delete(`${base}/${docId}`).set(...XRW);
    expect(deleted.status).toBe(204);
    expect(countStoredFiles()).toBe(0);
  });

  it("rejects a file that only pretends to be a PDF", async () => {
    const agent = await getAuthAgent();
    const app = await createApplication(agent);

    const res = await agent
      .post(`/api/v1/applications/${app.id}/documents`)
      .set(...XRW)
      .attach("file", Buffer.from("<script>alert(1)</script>"), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(422);
    expect(countStoredFiles()).toBe(0);
  });

  it("rejects files over 5 MB", async () => {
    const agent = await getAuthAgent();
    const app = await createApplication(agent);
    const big = Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024)]);

    const res = await agent
      .post(`/api/v1/applications/${app.id}/documents`)
      .set(...XRW)
      .attach("file", big, { filename: "big.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(422);
    expect(res.body.error.details[0].message).toMatch(/5 MB/);
  });

  it("does not let another user download my document", async () => {
    const owner = await getAuthAgent("owner@test.com");
    const app = await createApplication(owner);
    const uploaded = await owner
      .post(`/api/v1/applications/${app.id}/documents`)
      .set(...XRW)
      .attach("file", PDF, { filename: "resume.pdf", contentType: "application/pdf" });

    const intruder = await getAuthAgent("intruder@test.com");
    const res = await intruder.get(
      `/api/v1/applications/${app.id}/documents/${uploaded.body.data.id}/download`,
    );
    expect(res.status).toBe(404);
  });

  it("removes stored files when the application is deleted", async () => {
    const agent = await getAuthAgent();
    const app = await createApplication(agent);
    await agent
      .post(`/api/v1/applications/${app.id}/documents`)
      .set(...XRW)
      .attach("file", PDF, { filename: "resume.pdf", contentType: "application/pdf" });
    expect(countStoredFiles()).toBe(1);

    const res = await agent.delete(`/api/v1/applications/${app.id}`).set(...XRW);
    expect(res.status).toBe(204);
    expect(countStoredFiles()).toBe(0);
  });
});
