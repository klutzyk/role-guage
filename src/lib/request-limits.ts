export const maxResumeTextChars = 12_000;
export const maxJobTextChars = 16_000;
export const maxPageTitleChars = 180;
export const maxPageUrlChars = 2_048;
export const maxImportedHtmlChars = 1_200_000;
export const maxResumePdfPages = 20;

export function cleanBoundedText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

export function cleanOneLine(value: unknown, maxLength: number) {
  return cleanBoundedText(value, maxLength).replace(/\s+/g, " ");
}

export function cleanPublicUrl(value: unknown) {
  const input = cleanOneLine(value, maxPageUrlChars);

  if (!input) return "";

  try {
    const url = new URL(input);

    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString().slice(0, maxPageUrlChars)
      : "";
  } catch {
    return "";
  }
}
