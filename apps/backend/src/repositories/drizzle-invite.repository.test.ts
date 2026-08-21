import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { createDatabase, type DatabaseHandle } from "../db/client.js";
import { DrizzleInviteRepository } from "./drizzle-invite.repository.js";

let handle: DatabaseHandle;
let repo: DrizzleInviteRepository;

beforeEach(async () => {
  handle = await createDatabase(":memory:");
  repo = new DrizzleInviteRepository(handle.db);
  await handle.raw.execute(
    "INSERT INTO invited_emails (email, created_at) VALUES ('friend@gmail.com', '2026-08-21T00:00:00.000Z')",
  );
});

afterEach(() => handle.close());

describe("DrizzleInviteRepository.isInvited", () => {
  it("returns true for an invited email", async () => {
    expect(await repo.isInvited("friend@gmail.com")).toBe(true);
  });

  it("matches case-insensitively", async () => {
    expect(await repo.isInvited("Friend@Gmail.com")).toBe(true);
  });

  it("returns false for an unknown email", async () => {
    expect(await repo.isInvited("stranger@gmail.com")).toBe(false);
  });
});
