const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const validateEmail = (v: string): string | null =>
  EMAIL.test(v.trim()) ? null : "Enter a valid email address";
export const validatePassword = (v: string): string | null =>
  v.length >= 8 ? null : "Password must be at least 8 characters";
export const validateName = (v: string): string | null => (v.trim() ? null : "Name is required");
export const validateMatch = (a: string, b: string): string | null => (a === b ? null : "Passwords do not match");

/** Returns the first non-null error, or null if all checks pass. */
export const firstError = (...errors: (string | null)[]): string | null => errors.find((e) => e) ?? null;
