import { beforeEach, describe, expect, it } from "vitest";

import {
  isCorrectMemoryAnswer,
  loadReminderState,
  REMINDER_STORAGE_PREFIX,
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