import { afterEach, beforeEach, describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import { createContainer, type Container } from "./container.js";

let container: Container;
let app: ReturnType<typeof createApp>;
let seq = 0;

beforeEach(() => {
  seq = 0;
  container = createContainer({
    generateId: () => `id-${++seq}`,
    now: () => "2026-08-17T00:00:00.000Z",
  });
  app = createApp(container);
});

afterEach(() => {
  container.close();
});

const validBody = {
  title: "Cream Sky",
  artist: "The Grooves",
  bpm: 120,
  scale: "C",
  language: "English",
  verseChords: "C, G, Am, F",
  chorusChords: "F, C, G, Am",
};

describe("POST /api/songs", () => {
  it("creates a song and returns 201 with translated degrees", async () => {
    const res = await request(app).post("/api/songs").send(validBody);
    expect(res.status).toBe(201);
    expect(res.body.verseDegrees).toEqual(["1", "5", "6m", "4"]);
  });

  it("rejects invalid bodies with 400", async () => {
    const res = await request(app).post("/api/songs").send({ ...validBody, bpm: -5 });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid scale root with 400", async () => {
    const res = await request(app).post("/api/songs").send({ ...validBody, scale: "H" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/songs/batch", () => {
  it("imports valid rows, skips bad ones, and returns 201 with results", async () => {
    const res = await request(app)
      .post("/api/songs/batch")
      .send({
        songs: [
          { ...validBody, title: "First" },
          { ...validBody, title: "Bad", verseChords: "C, Zork, F" },
          { ...validBody, title: "Second" },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.created.map((s: { title: string }) => s.title)).toEqual(["First", "Second"]);
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0].row).toBe(2);
  });

  it("rejects an empty songs array with 400", async () => {
    const res = await request(app).post("/api/songs/batch").send({ songs: [] });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/songs", () => {
  it("paginates", async () => {
    await request(app).post("/api/songs").send({ ...validBody, title: "One" });
    await request(app).post("/api/songs").send({ ...validBody, title: "Two" });
    const res = await request(app).get("/api/songs?page=1&pageSize=1");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items).toHaveLength(1);
  });
});

describe("GET /api/songs/search", () => {
  it("matches titles case-insensitively", async () => {
    await request(app).post("/api/songs").send({ ...validBody, title: "Cream Sky" });
    const res = await request(app).get("/api/songs/search?q=cream");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe("GET /api/songs/:id/suggestions", () => {
  it("returns compatible songs", async () => {
    const target = await request(app).post("/api/songs").send({ ...validBody, title: "Target" });
    await request(app)
      .post("/api/songs")
      .send({
        ...validBody,
        title: "Match",
        scale: "G",
        verseChords: "G, D, Em, C",
        chorusChords: "C, G, D, Em",
      });
    const res = await request(app).get(`/api/songs/${target.body.id}/suggestions`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].song.title).toBe("Match");
    expect(res.body[0].bestMatch.target).toBe("verse");
    expect(res.body[0]).not.toHaveProperty("verseSimilarity");
  });
});

describe("GET /api/songs/:id", () => {
  it("returns 404 for a missing song", async () => {
    const res = await request(app).get("/api/songs/nope");
    expect(res.status).toBe(404);
  });
});
