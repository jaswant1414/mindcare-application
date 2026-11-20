export type MemoryItem = {
  id: string;
  name: string;
  prompt: string;
  hint: string;
  image: string;
  aliases: string[];
};

export type FamilyVoiceItem = {
  id: string;
  name: string;
  relation: string;
  prompt: string;
  hint: string;
  aliases: string[];
  audioData?: string;
  speechPitch?: number;
};

export const DEFAULT_FAMILY_VOICES: FamilyVoiceItem[] = [
  {
    id: "priya-granddaughter",
    name: "Priya",
    relation: "Granddaughter",
    prompt: "Good morning Dadu! Have you had your warm cup of morning tea?",
    hint: "She is your granddaughter who loves visiting and making tea for you.",
    aliases: ["priya", "granddaughter", "grand daughter", "natni", "nati"],
    speechPitch: 1.22,
  },
  {
    id: "rahul-son",
    name: "Rahul",
    relation: "Son",
    prompt: "Namaste Baba! Did you go for your gentle afternoon walk today?",
    hint: "Your loving son who always checks in on your daily walk.",
    aliases: ["rahul", "son", "beta", "putra"],
    speechPitch: 0.95,
  },
  {
    id: "ananya-daughter",
    name: "Ananya",
    relation: "Daughter",
    prompt: "Hello Ma! I am preparing your favourite sweet dish for this weekend.",
    hint: "Your caring daughter who loves bringing home-cooked sweets.",
    aliases: ["ananya", "daughter", "beti", "jiya"],
    speechPitch: 1.15,
  },
];

export const FAMILY_VOICES_STORAGE_KEY = "mindcare-family-voices";

export function loadFamilyVoices(): FamilyVoiceItem[] {
  if (typeof window === "undefined") return DEFAULT_FAMILY_VOICES;

  try {
    const stored = window.localStorage.getItem(FAMILY_VOICES_STORAGE_KEY);
    if (!stored) return DEFAULT_FAMILY_VOICES;
    const parsed = JSON.parse(stored) as FamilyVoiceItem[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_FAMILY_VOICES;
  } catch {
    return DEFAULT_FAMILY_VOICES;
  }
}

export function saveFamilyVoices(voices: FamilyVoiceItem[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(FAMILY_VOICES_STORAGE_KEY, JSON.stringify(voices));
  } catch {
    // Falls back to session memory if storage is unavailable.
  }
}

export type ReminderKey = "medicine" | "water" | "walk";
export type ReminderState = Partial<Record<ReminderKey, boolean>>;

export type SessionRound = {
  latencySeconds: number;
};

export type SessionData = {
  rounds: SessionRound[];
};

export const REMINDER_STORAGE_PREFIX = "mindcare-reminders-";
export const SESSION_STORAGE_PREFIX = "mindcare-session-";

export function localDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeAnswer(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function editDistance(left: string, right: string) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let previous = row[0] ?? 0;
    row[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const current = row[rightIndex] ?? 0;
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      row[rightIndex] = Math.min(
        (row[rightIndex - 1] ?? 0) + 1,
        current + 1,
        previous + substitutionCost,
      );
      previous = current;
    }
  }

  return row[right.length] ?? 0;
}

export function isCorrectMemoryAnswer(spoken: string, acceptedAnswers: string[]) {
  const answer = normalizeAnswer(spoken);
  if (!answer) return false;

  return acceptedAnswers.some((candidate) => {
    const normalizedCandidate = normalizeAnswer(candidate);
    if (answer === normalizedCandidate || answer.includes(normalizedCandidate)) return true;

    const answerWords = answer.split(" ");
    const candidateWords = normalizedCandidate.split(" ");
    if (candidateWords.some((word) => word.length >= 3 && answerWords.includes(word))) return true;

    return (
      answer.length >= 4 &&
      normalizedCandidate.length >= 4 &&
      editDistance(answer, normalizedCandidate) <= 1
    );
  });
}

export function loadReminderState(day = localDayKey()): ReminderState {
  if (typeof window === "undefined") return {};

  try {
    const stored = window.localStorage.getItem(`${REMINDER_STORAGE_PREFIX}${day}`);
    return stored ? (JSON.parse(stored) as ReminderState) : {};
  } catch {
    return {};
  }
}

export function saveReminderState(state: ReminderState, day = localDayKey()) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(`${REMINDER_STORAGE_PREFIX}${day}`, JSON.stringify(state));
  } catch {
    // The reminders still work for this visit if browser storage is unavailable.
  }
}

export function loadSessionData(day = localDayKey()): SessionData {
  if (typeof window === "undefined") return { rounds: [] };

  try {
    const stored = window.localStorage.getItem(`${SESSION_STORAGE_PREFIX}${day}`);
    return stored ? (JSON.parse(stored) as SessionData) : { rounds: [] };
  } catch {
    return { rounds: [] };
  }
}

export function recordSessionRound(latencySeconds: number, day = localDayKey()) {
  if (typeof window === "undefined") return;

  const session = loadSessionData(day);
  session.rounds.push({ latencySeconds: Math.max(0, latencySeconds) });

  try {
    window.localStorage.setItem(`${SESSION_STORAGE_PREFIX}${day}`, JSON.stringify(session));
  } catch {
    // The round remains playable if browser storage is unavailable.
  }
}

export function getWeeklyActivity(today = new Date()) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - index));
    const data = loadSessionData(localDayKey(date));
    return {
      key: localDayKey(date),
      day: date.toLocaleDateString("en-IN", { weekday: "short" }),
      rounds: data.rounds.length,
    };
  });
}