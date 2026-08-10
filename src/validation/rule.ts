/**
 * A rule returns the error message, or `null` when the value passes.
 *
 * Rules are pure and framework-free, and are shared by both implementations of
 * the demo: the comparison must isolate the *orchestration*, not the writing of
 * the rules themselves.
 */
export type Rule<T> = (value: T) => string | null;
