import { beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_FAMILY_VOICES,
  FAMILY_VOICES_STORAGE_KEY,
  isCorrectMemoryAnswer,
  loadFamilyVoices,
  loadReminderState,
  REMINDER_STORAGE_PREFIX,
  saveFamilyVoices,
  saveReminderState,
} from "@/lib/mindcare";

describe("MindCare memory answers", () => {
  it("accepts the local tea name, its English synonym, and a partial local name", () => {
    const acceptedAnswers = ["Lal Cha", "Cha", "Tea"];

    expect(isCorrectMemoryAnswer("Lal Cha", acceptedAnswers)).toBe(true);
    expect(isCorrectMemoryAnswer("tea", acceptedAnswers)).toBe(true);
    expect(isCorrectMemoryAnswer("cha", acceptedAnswers)).toBe(true);
  });
});

describe("MindCare reminder privacy", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps a taken reminder in local browser storage for the selected day", () => {
    const reminderState = { medicine: true };

    saveReminderState(reminderState, "2026-11-18");

    expect(loadReminderState("2026-11-18")).toEqual(reminderState);
    expect(window.localStorage.getItem(`${REMINDER_STORAGE_PREFIX}2026-11-18`)).toBe(
      JSON.stringify(reminderState),
    );
  });
});

describe("MindCare family voices", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("loads default family voices when storage is empty", () => {
    const voices = loadFamilyVoices();
    expect(voices.length).toBeGreaterThan(0);
    expect(voices[0]?.name).toBe("Priya");
    expect(voices[0]?.relation).toBe("Granddaughter");
  });

  it("persists custom family voices in local storage", () => {
    const custom = [
      {
        id: "custom-1",
        name: "Aarav",
        relation: "Grandson",
        prompt: "Hello Dadu, how are you today?",
        hint: "Your grandson Aarav.",
        aliases: ["aarav", "grandson", "pota"],
      },
    ];

    saveFamilyVoices(custom);

    expect(loadFamilyVoices()).toEqual(custom);
    expect(window.localStorage.getItem(FAMILY_VOICES_STORAGE_KEY)).toBe(JSON.stringify(custom));
  });

  it("correctly identifies spoken answers for family members", () => {
    const aliases = ["priya", "granddaughter", "natni"];

    expect(isCorrectMemoryAnswer("Priya", aliases)).toBe(true);
    expect(isCorrectMemoryAnswer("my granddaughter", aliases)).toBe(true);
    expect(isCorrectMemoryAnswer("natni", aliases)).toBe(true);
    expect(isCorrectMemoryAnswer("stranger", aliases)).toBe(false);
  });
});
