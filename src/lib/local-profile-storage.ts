"use client";

const roleGuageLocalStorageKeys = [
  "roleguage.resume-profile.v1",
  "roleguage.resume-profile-name.v1",
  "applypilot.resume-profile.v1",
  "roleguage.match-history.v1",
  "roleguage.candidate-profile.v1",
  "roleguage.cover-letter-preferences.v1",
  "roleguage.cover-letter-examples.v1",
];

export function clearLocalRoleGuageData() {
  if (typeof window === "undefined") return;

  for (const key of roleGuageLocalStorageKeys) {
    window.localStorage.removeItem(key);
  }

  window.dispatchEvent(new Event("roleguage:local-data-cleared"));
}
