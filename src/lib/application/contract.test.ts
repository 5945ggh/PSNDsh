import { describe, expect, it } from "vitest";
import { profileUpdateSchema } from "./contract";

describe("profileUpdateSchema", () => {
  it("accepts an optional valid email and normalizes profile text", () => {
    expect(profileUpdateSchema.parse({
      nickname: "  小明  ",
      email: "  person@example.com  ",
    })).toEqual({ nickname: "小明", email: "person@example.com" });
  });

  it("rejects invalid email addresses before they reach persistence", () => {
    expect(() => profileUpdateSchema.parse({ email: "not-an-email" })).toThrow(/邮箱格式不正确/);
  });

  it("permits clearing optional profile fields but rejects unknown fields", () => {
    expect(profileUpdateSchema.parse({ nickname: null, email: null })).toEqual({
      nickname: null,
      email: null,
    });
    expect(() => profileUpdateSchema.parse({ email: null, role: "admin" })).toThrow();
  });
});
