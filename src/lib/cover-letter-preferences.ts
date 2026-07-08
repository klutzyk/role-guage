export const coverLetterPreferencesStorageKey = "roleguage.cover-letter-preferences.v1";
export const coverLetterExamplesStorageKey = "roleguage.cover-letter-examples.v1";
export const coverLetterPreferencesMaxLength = 3000;
export const coverLetterExampleMaxLength = 1800;
export const coverLetterExamplesMaxCount = 3;

export const defaultCoverLetterPreferences = `Study the example letters before writing.

Your goal is to write like the same applicant, not to improve the writing.

Match the examples' tone, pacing, paragraph length, sentence length, level of detail, and restraint.

Do not make the writing more polished, more persuasive, or more impressive than the examples.

The examples intentionally avoid sales language.

Do not add extra technical detail, business language, or professional-sounding filler.

Do not invent stronger wording than the resume supports.

Keep the writing simple.

Imagine the applicant is explaining their background during a conversation rather than trying to market themselves.

The hiring manager already has the resume.

Only explain the career direction and why this role makes sense.

If a personal project is clearly relevant to the role, mention it briefly once in plain language. Do not list every feature.

For AI, data, automation, or software integration roles, briefly connect the role to practical project work around AI, LLMs, data, automation, APIs, or full-stack applications.

For software engineering roles, focus on the commercial software engineering background first and mention AI/data projects only if they help explain the role fit.

Avoid phrases like:
- I am writing to express my interest
- I am excited
- I am passionate
- I am eager
- I am confident
- proven track record
- add value
- leverage my experience
- robust
- scalable
- career trajectory
- natural progression
- solid foundation

End with:
Kind regards,
Kulunu Abeysinghe`;

export const sampleCoverLetterExample = `Hi Team,

I recently completed a Master of Data Science at Monash. Before that I worked for just over four years as a software engineer building backend systems, APIs, and full stack applications.

Most of my professional experience has been traditional software engineering, but over the last couple of years I've spent a lot of time building projects around data and machine learning. I originally got interested in the modelling side of things, but ended up spending a lot of time dealing with data pipelines, APIs, automation, and all the other parts needed to get something working end to end.

That's probably why this role stood out. It seems to be aimed at people who are interested in AI but still have a software engineering foundation underneath it.

I don't have years of commercial AI experience. What I do have is a software engineering background, a data science degree, and a lot of time spent building and experimenting with things on my own. I'm comfortable picking up new technologies and figuring things out as I go.

Thank you for your consideration.

Kind regards,
Kulunu`;

export const personalCoverLetterExamples = [
  sampleCoverLetterExample,
  `Hi Team,

Before starting my Master of Data Science at Monash, I spent just over four years working as a software engineer building backend systems, APIs and full stack applications. While I enjoyed that work, I became increasingly interested in the data side of software and started spending more of my own time building projects around machine learning and automation.

Those projects ended up being much broader than just training models. Most of the work involved collecting data, building APIs, creating web applications and figuring out how all the pieces fit together. It gave me a better appreciation of building complete systems rather than working on individual components.

That's why this role caught my attention. It combines software engineering with the sort of practical AI and data work I've been moving towards over the last couple of years.

I don't claim to know every technology listed in the advertisement, but I do enjoy learning new things and I'm comfortable working my way through unfamiliar problems. I think my software engineering background gives me a solid base to continue building in that direction.

Thank you for your consideration.

Kind regards,
Kulunu Abeysinghe`,
//   `Hi Team,

// Most of my professional experience has been in software engineering, where I spent over four years building backend services, APIs and full stack applications. After completing my Master of Data Science, I started spending much more time building personal projects that combine software engineering with data, automation and AI.

// One thing I have enjoyed about those projects is that they involve much more than writing models. They require building APIs, designing applications, working with different data sources and getting everything working together. I find that end-to-end side of development just as interesting as the modelling itself.

// This role feels like a good fit because it sits between those two areas. It looks like the kind of position where a software engineering background is useful while still providing the opportunity to keep moving further into AI and data-driven systems.

// I know there will be things I haven't worked with before, but I'm happy learning new technologies when they're needed and I've always enjoyed that part of software engineering.

// Thank you for your consideration.

// Kind regards,
// Kulunu Abeysinghe`,
];

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
