const TAG_REGEX = /<[^>]*>/g;
const NULL_CHAR = '\u0000';

export function sanitizePlainText(value: string) {
  return value.replace(TAG_REGEX, '').split(NULL_CHAR).join('').trim();
}

export function sanitizeOptionalText(value?: string | null) {
  if (value === undefined || value === null) {
    return value ?? undefined;
  }

  return sanitizePlainText(value);
}

export function sanitizeStringArray(values: string[]) {
  return values.map((value) => sanitizePlainText(value));
}
