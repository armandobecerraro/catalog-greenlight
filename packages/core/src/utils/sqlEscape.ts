/**
 * Escape a string for safe embedding inside a single-quoted ClickHouse string
 * literal.
 *
 * ClickHouse interprets backslash escape sequences inside single-quoted
 * literals by default, so a naive quote-doubling leaves an injection path via
 * `\'`. Escaping backslashes first and then doubling single quotes guarantees
 * the value cannot terminate the literal early (a crafted `\'; DROP ...` is
 * neutralized and treated as literal content).
 */
export function escapeSqlLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "''");
}
