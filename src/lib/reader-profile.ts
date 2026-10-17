// The "about you" answers from the search flow. Mirrors the questions in the
// Bill Breaker Colab notebook; every one is optional.
//
// Answers are personal data, so they live in sessionStorage only: never in the
// URL, never sent anywhere yet, and gone when the tab closes.

export type ReaderProfile = {
  state?: string;
  age?: string;
  work?: string;
  household?: string;
  health?: string;
  military?: string;
  income?: string;
  interests?: string;
};

export type ProfileKey = keyof ReaderProfile;

export type Question = {
  key: ProfileKey;
  label: string;
  hint?: string;
  choices?: string[];
  free?: boolean;
};

export const QUESTIONS: Question[] = [
  { key: "state", label: "Your state" },
  {
    key: "age",
    label: "Age",
    choices: ["Under 18", "18-24", "25-44", "45-64", "65+"],
  },
  {
    key: "work",
    label: "Work",
    hint: "Job, student, retired…",
    free: true,
  },
  {
    key: "household",
    label: "Household",
    choices: ["Just me", "Partner", "Kids", "An elderly parent"],
    free: true,
  },
  {
    key: "health",
    label: "Health coverage",
    choices: ["Employer", "Medicare", "Medicaid", "Marketplace", "VA", "None"],
  },
  {
    key: "military",
    label: "Military family",
    choices: ["Yes", "No"],
  },
  {
    key: "income",
    label: "Household income",
    choices: ["Under $30k", "$30-75k", "$75-150k", "Over $150k"],
  },
  {
    key: "interests",
    label: "Issues you care about",
    hint: "Taxes, schools, climate…",
    free: true,
  },
];

const KEY = "bb_reader_v1";

export function readProfile(): ReaderProfile {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ReaderProfile) : {};
  } catch {
    return {};
  }
}

export function saveProfile(p: ReaderProfile) {
  const clean = Object.fromEntries(
    Object.entries(p).filter(([, v]) => typeof v === "string" && v.trim()),
  ) as ReaderProfile;
  try {
    if (Object.keys(clean).length) sessionStorage.setItem(KEY, JSON.stringify(clean));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* private mode: the profile just won't carry over */
  }
  return clean;
}

export function clearProfile() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
