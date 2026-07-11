import {
  cleanCoverLetterExamples,
  cleanCoverLetterPreferences,
  defaultCoverLetterPreferences,
} from "@/lib/cover-letter-preferences";
import { CandidateProfile } from "@/lib/requirements";
import { cleanBoundedText, cleanOneLine, maxResumeTextChars } from "@/lib/request-limits";

export const accountProfileMaxResumeNameChars = 180;

export type AccountProfile = {
  resumeText: string;
  resumeFileName: string;
  candidateProfile: CandidateProfile;
  coverLetterInstructions: string;
  coverLetterExamples: string[];
};

export type AccountProfileRow = {
  user_id: string;
  resume_text: string | null;
  resume_file_name: string | null;
  candidate_profile: CandidateProfile | null;
  cover_letter_instructions: string | null;
  cover_letter_examples: string[] | null;
  updated_at: string;
};

export function cleanAccountProfile(value: unknown): AccountProfile {
  const record = isRecord(value) ? value : {};

  return {
    resumeText: cleanBoundedText(record.resumeText, maxResumeTextChars),
    resumeFileName: cleanOneLine(record.resumeFileName, accountProfileMaxResumeNameChars),
    candidateProfile: cleanCandidateProfile(record.candidateProfile),
    coverLetterInstructions:
      cleanCoverLetterPreferences(record.coverLetterInstructions) || defaultCoverLetterPreferences,
    coverLetterExamples: cleanCoverLetterExamples(record.coverLetterExamples),
  };
}

export function accountProfileFromRow(row: AccountProfileRow | null): AccountProfile | null {
  if (!row) return null;

  return cleanAccountProfile({
    resumeText: row.resume_text ?? "",
    resumeFileName: row.resume_file_name ?? "",
    candidateProfile: row.candidate_profile ?? {},
    coverLetterInstructions: row.cover_letter_instructions ?? "",
    coverLetterExamples: row.cover_letter_examples ?? [],
  });
}

export function accountProfileToRow(profile: AccountProfile, userId: string) {
  return {
    user_id: userId,
    resume_text: profile.resumeText || null,
    resume_file_name: profile.resumeFileName || null,
    candidate_profile: profile.candidateProfile,
    cover_letter_instructions: profile.coverLetterInstructions,
    cover_letter_examples: profile.coverLetterExamples,
    updated_at: new Date().toISOString(),
  };
}

export function cleanCandidateProfile(value: unknown): CandidateProfile {
  const record = isRecord(value) ? value : {};

  const driversLicence = cleanOneLine(record.driversLicence, 24);

  return {
    workRights: cleanOneLine(record.workRights, 180),
    visaExpiry: cleanOneLine(record.visaExpiry, 80),
    location: cleanOneLine(record.location, 180),
    workMode: cleanOneLine(record.workMode, 180),
    driversLicence:
      driversLicence === "yes" || driversLicence === "no" || driversLicence === "unknown"
        ? driversLicence
        : "",
    securityClearance: cleanOneLine(record.securityClearance, 120),
    licences: cleanOneLine(record.licences, 500),
    minimumSalary: cleanOneLine(record.minimumSalary, 80),
    targetRoles: cleanOneLine(record.targetRoles, 500),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
