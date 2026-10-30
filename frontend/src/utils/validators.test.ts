import { firstError, validateEmail, validateMatch, validateName, validatePassword } from "./validators";

describe("validators", () => {
  it("validates emails", () => {
    expect(validateEmail("a@b.io")).toBeNull();
    expect(validateEmail("nope")).not.toBeNull();
    expect(validateEmail("a@b")).not.toBeNull();
  });
  it("requires 8+ character passwords", () => {
    expect(validatePassword("1234567")).not.toBeNull();
    expect(validatePassword("12345678")).toBeNull();
  });
  it("checks name and password confirmation", () => {
    expect(validateName("  ")).not.toBeNull();
    expect(validateMatch("a", "b")).not.toBeNull();
    expect(validateMatch("a", "a")).toBeNull();
  });
  it("returns the first error", () => {
    expect(firstError(null, "x", "y")).toBe("x");
    expect(firstError(null, null)).toBeNull();
  });
});
