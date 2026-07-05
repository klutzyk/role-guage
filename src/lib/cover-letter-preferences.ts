export const coverLetterPreferencesStorageKey = "roleguage.cover-letter-preferences.v1";
export const coverLetterPreferencesMaxLength = 1200;

export const defaultCoverLetterPreferences = `Write in a natural, professional tone.
Keep it concise and specific to the role.
Use plain language and avoid hype.
Focus on the strongest relevant evidence from my resume.
Do not exaggerate, invent experience, or use generic corporate phrases.
If the role is a poor fit or has a hard blocker, say that clearly instead of forcing a positive cover letter.`;

export function cleanCoverLetterPreferences(value: unknown) {
  const text = typeof value === "string" ? value : "";

  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[^\S\r\n]{3,}/g, " ")
    .trim()
    .slice(0, coverLetterPreferencesMaxLength);
}
