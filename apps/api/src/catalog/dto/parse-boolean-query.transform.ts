import { Transform } from 'class-transformer';

/**
 * Query-string booleans arrive as the literal strings "true"/"false" (or
 * are absent). `Boolean("false")` is `true` in JS, so a plain `@Type(() =>
 * Boolean)` silently does the wrong thing — this decorator parses the
 * two accepted string values explicitly and leaves anything else (most
 * importantly `undefined`, when the filter wasn't supplied) untouched.
 */
export function TransformBooleanQueryParam(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  });
}
