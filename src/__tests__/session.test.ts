import { describe, it, expect, beforeEach } from "vitest";
import {
  sealSessionData,
  readSessionFromCookie,
  type SessionData,
} from "@/lib/session";

beforeEach(() => {
  process.env.SESSION_PASSWORD =
    "test-session-password-32-chars-or-more!!!";
});

const SAMPLE: SessionData = {
  userId: 7,
  username: "tester",
  displayName: "Tester",
  role: "inspector",
  issuedAt: 1_700_000_000_000,
};

describe("session helpers", () => {
  it("seals and reads back the same payload", async () => {
    const sealed = await sealSessionData(SAMPLE);
    expect(sealed).toBeTypeOf("string");
    const read = await readSessionFromCookie(sealed);
    expect(read).toEqual(SAMPLE);
  });

  it("returns null for a tampered cookie", async () => {
    const sealed = await sealSessionData(SAMPLE);
    const tampered = sealed.slice(0, -3) + "AAA";
    expect(await readSessionFromCookie(tampered)).toBeNull();
  });

  it("returns null when cookie is undefined", async () => {
    expect(await readSessionFromCookie(undefined)).toBeNull();
  });
});
