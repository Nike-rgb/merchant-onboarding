/**
 * Defense-in-depth against logging sensitive data. Any key whose name matches
 * a sensitive pattern is replaced with '[REDACTED]' before it reaches the
 * audit store. Values like tax ids are additionally masked to last-4.
 */
const SENSITIVE_KEY_PATTERN =
  /pass(word)?|secret|token|authorization|api[-_]?key|ssn|tax[-_]?id|card|cvv|pin/i;

export function maskLast4(value?: string | null): string | null {
  if (!value) return value ?? null;
  const trimmed = value.replace(/\s|-/g, '');
  if (trimmed.length <= 4) return '****';
  return `****${trimmed.slice(-4)}`;
}

export function redact(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map((item) => redact(item));
  }
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = redact(value);
      }
    }
    return out;
  }
  return input;
}
