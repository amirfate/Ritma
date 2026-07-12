/**
 * Asserts that a condition holds, narrowing the condition's type for the
 * remainder of the scope. Throws an `Error` with the given message when the
 * condition is falsy.
 */
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invariant violation: ${message}`);
  }
}
