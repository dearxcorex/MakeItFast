import { describe, it, expect } from "vitest";
import {
  generatePassword,
  GENERATED_PASSWORD_LENGTH,
} from "@/lib/passwordGenerator";

const AMBIGUOUS = /[0O1lI]/;

describe("generatePassword", () => {
  it("defaults to the documented length", () => {
    expect(generatePassword()).toHaveLength(GENERATED_PASSWORD_LENGTH);
  });

  it("honours an explicit length", () => {
    expect(generatePassword(24)).toHaveLength(24);
  });

  it("rejects lengths below the API minimum", () => {
    expect(() => generatePassword(7)).toThrow();
  });

  it("always satisfies the 8-char server policy", () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePassword().length).toBeGreaterThanOrEqual(8);
    }
  });

  it("includes all four character classes", () => {
    for (let i = 0; i < 50; i++) {
      const pw = generatePassword();
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[2-9]/);
      expect(pw).toMatch(/[!@#$%^&*\-_=+]/);
    }
  });

  it("omits glyphs that are misread during verbal handover", () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePassword()).not.toMatch(AMBIGUOUS);
    }
  });

  it("does not pin the guaranteed classes to the first four slots", () => {
    // Without the shuffle, index 3 would be a symbol every single time.
    const symbolAtIndex3 = Array.from({ length: 60 }, () =>
      /[!@#$%^&*\-_=+]/.test(generatePassword()[3])
    ).filter(Boolean).length;
    expect(symbolAtIndex3).toBeLessThan(60);
  });

  it("does not repeat", () => {
    const seen = new Set(Array.from({ length: 200 }, () => generatePassword()));
    expect(seen.size).toBe(200);
  });
});
