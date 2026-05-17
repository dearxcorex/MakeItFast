import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password helpers", () => {
  it("verifies a correctly hashed password", async () => {
    const hash = await hashPassword("hunter2!!");
    expect(await verifyPassword("hunter2!!", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("hunter2!!");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("produces different hashes for the same password (salt)", async () => {
    const h1 = await hashPassword("same");
    const h2 = await hashPassword("same");
    expect(h1).not.toBe(h2);
  });
});
