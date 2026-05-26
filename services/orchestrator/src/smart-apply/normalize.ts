/**
 * Label normalizer for Smart Apply.
 *
 * Greenhouse labels vary widely ("Are you authorized to work in the U.S.? *",
 * "Current Salary (annual)", "Visa sponsorship required?"). We collapse them
 * to a stable `question_key` that field_mappings + saved_answers can index.
 *
 * Rules:
 *   - lowercase
 *   - strip "(required)" / asterisks
 *   - strip parenthesized hints
 *   - normalize whitespace to single space
 *   - drop trailing question marks / colons / periods
 *   - collapse common variants (U.S. -> us, & -> and)
 */
export function normalizeLabel(raw: string): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")         // smart quotes -> straight
    .replace(/\bu\.?s\.?(a)?\b/g, 'us')                  // "U.S.A" -> "us"
    .replace(/&/g, 'and')
    .replace(/\(.*?\)/g, ' ')                            // strip parens content
    .replace(/\*/g, '')                                  // strip required asterisks
    .replace(/\brequired\b/g, '')
    .replace(/[?.:;,!]/g, ' ')                           // punctuation -> space
    .replace(/[^a-z0-9\s/-]/g, ' ')                      // strip emoji / weird chars
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strict equality for two normalized labels — handy in tests. */
export function labelsEqual(a: string, b: string): boolean {
  return normalizeLabel(a) === normalizeLabel(b);
}
