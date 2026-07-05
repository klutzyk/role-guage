export const coverLetterPreferencesStorageKey = "roleguage.cover-letter-preferences.v1";
export const coverLetterExamplesStorageKey = "roleguage.cover-letter-examples.v1";
export const coverLetterPreferencesMaxLength = 3000;
export const coverLetterExampleMaxLength = 1800;
export const coverLetterExamplesMaxCount = 3;

export const defaultCoverLetterPreferences = `Write in a natural, professional tone.
Keep it concise and specific to the role.
Use plain language and avoid hype.
Focus on the strongest relevant evidence from my resume.
Do not exaggerate, invent experience, or use generic corporate phrases.
Do not turn broad resume wording into more specific claims.
Do not use phrases like proven track record, contribute immediately, mission, objectives, robust, scalable, or secure unless the resume evidence directly supports that wording.
If the role is a poor fit or has a hard blocker, say that clearly instead of forcing a positive cover letter.`;

export const sampleCoverLetterExample = `Hi Hiring Manager,

I recently completed a Bachelor of Computer Science and have spent the last two years working as a software developer, mostly around backend services, APIs, and small internal tools.

Most of my experience has been in practical software work: understanding what a team needs, building something maintainable, and improving it as requirements become clearer. I have also spent time outside work building small projects to strengthen my understanding of cloud services, testing, and data handling.

This role makes sense to me because it sits close to the kind of engineering I enjoy most. I like working on systems that need to be clear, reliable, and useful to the people depending on them.

I am still early in my career, but I am comfortable learning quickly, asking good questions, and taking responsibility for the work I am given.

Thank you for your consideration.

Kind regards,
Alex`;

export function cleanCoverLetterPreferences(value: unknown) {
  const text = typeof value === "string" ? value : "";

  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[^\S\r\n]{3,}/g, " ")
    .trim()
    .slice(0, coverLetterPreferencesMaxLength);
}

export function cleanCoverLetterExample(value: unknown) {
  const text = typeof value === "string" ? value : "";

  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[^\S\r\n]{3,}/g, " ")
    .trim()
    .slice(0, coverLetterExampleMaxLength);
}

export function cleanCoverLetterExamples(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map(cleanCoverLetterExample)
    .filter((example) => example.length >= 120)
    .slice(0, coverLetterExamplesMaxCount);
}
