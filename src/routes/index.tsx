import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  BellRing,
  Check,
  CheckCircle2,
  Clock3,
  Footprints,
  HeartHandshake,
  Info,
  LockKeyhole,
  Mic,
  MicOff,
  Pill,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  Sun,
  Trash2,
  UserCheck,
  Users,
  Volume2,
  Waves,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import bambooBasketImage from "@/assets/bamboo-basket.jpg";
import gamosaImage from "@/assets/gamosa.jpg";
import japiHatImage from "@/assets/japi-hat.jpg";
import lalChaImage from "@/assets/lal-cha.jpg";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_FAMILY_VOICES,
  getWeeklyActivity,
  isCorrectMemoryAnswer,
  loadFamilyVoices,
  loadReminderState,
  loadSessionData,
  localDayKey,
  recordSessionRound,
  saveFamilyVoices,
  saveReminderState,
  type FamilyVoiceItem,
  type MemoryItem,
  type ReminderKey,
  type ReminderState,
  type SessionData,
} from "@/lib/mindcare";

export const Route = createFileRoute("/")({
  component: MindCare,
  head: () => ({
    meta: [
      { title: "MindCare NER — Gentle memory & daily care" },
      {
        name: "description",
        content:
          "A gentle, private memory companion with regional object recall, family voice memory, daily care reminders, and a family check-in view.",
      },
      { property: "og:title", content: "MindCare NER — Gentle memory & daily care" },
      {
        property: "og:description",
        content: "A gentle, private memory companion for families in North Eastern India.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type RecognitionResult = { transcript: string };
type RecognitionEvent = { results: ArrayLike<ArrayLike<RecognitionResult>> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionConstructor = new () => Recognition;
type BrowserWindow = Window & {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};

type Tab = "play" | "voices" | "reminders" | "dashboard";

const objects: MemoryItem[] = [
  {
    id: "japi",
    name: "Japi hat",
    prompt: "Idhu enna-nu sollunga paapom? Can you name this item?",
    hint: "This woven hat gives shade on a sunny day.",
    image: japiHatImage,
    aliases: ["japi", "japi hat", "hat", "assamese hat", "woven hat"],
  },
  {
    id: "lal-cha",
    name: "Lal cha",
    prompt: "Can you tell me what we drink from this little glass?",
    hint: "It is red and warm. Many of us drink it in the morning.",
    image: lalChaImage,
    aliases: ["lal cha", "laal cha", "cha", "tea", "red tea", "tea glass"],
  },
  {
    id: "gamosa",
    name: "Gamosa",
    prompt: "Do you remember the name of this special cloth?",
    hint: "It is white cotton with a beautiful red border.",
    image: gamosaImage,
    aliases: ["gamosa", "gamusa", "gamocha", "scarf", "cotton cloth"],
  },
  {
    id: "basket",
    name: "Bamboo basket",
    prompt: "What do we call this useful woven basket?",
    hint: "It is made from bamboo and can carry things from the market.",
    image: bambooBasketImage,
    aliases: ["bamboo basket", "basket", "tokri", "woven basket"],
  },
];

const reminders: {
  id: ReminderKey;
  label: string;
  time: string;
  detail: string;
  icon: typeof Pill;
  color: "red" | "green" | "blue";
}[] = [
  {
    id: "medicine",
    label: "Morning medicine",
    time: "8:00 AM",
    detail: "A little reminder for your morning medicine.",
    icon: Pill,
    color: "red",
  },
  {
    id: "water",
    label: "A glass of water",
    time: "10:00 AM",
    detail: "Time for a refreshing glass of water.",
    icon: Waves,
    color: "blue",
  },
  {
    id: "walk",
    label: "Evening walk",
    time: "5:00 PM",
    detail: "Shall we go for a gentle evening walk?",
    icon: Footprints,
    color: "green",
  },
];

function speak(text: string, rate = 0.86, pitch = 1.02) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-IN";
  utterance.rate = rate;
  utterance.pitch = pitch;
  window.speechSynthesis.speak(utterance);
}

function MindCare() {
  const [tab, setTab] = useState<Tab>("play");

  // Play tab state
  const [gameStarted, setGameStarted] = useState(false);
  const [roundIndex, setRoundIndex] = useState(0);
  const [hintVisible, setHintVisible] = useState(false);
  const [feedback, setFeedback] = useState<"success" | "gentle" | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);

  // Family Voices state
  const [familyVoices, setFamilyVoices] = useState<FamilyVoiceItem[]>([]);
  const [voiceGameStarted, setVoiceGameStarted] = useState(false);
  const [voiceRoundIndex, setVoiceRoundIndex] = useState(0);
  const [voiceHintVisible, setVoiceHintVisible] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState<"success" | "gentle" | null>(null);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [isManagingVoices, setIsManagingVoices] = useState(false);

  // Family Voice Recording state
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRelation, setNewMemberRelation] = useState("");
  const [newMemberPrompt, setNewMemberPrompt] = useState("");
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Reminders and session data
  const [reminderState, setReminderState] = useState<ReminderState>({});
  const [voiceAlarm, setVoiceAlarm] = useState(false);
  const [sessionData, setSessionData] = useState<SessionData>({ rounds: [] });
  const [weeklyActivity, setWeeklyActivity] = useState<ReturnType<typeof getWeeklyActivity>>([]);
  const [installed, setInstalled] = useState(false);

  const recognitionRef = useRef<Recognition | null>(null);
  const roundStartedAt = useRef(0);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const voiceRoundStartedAt = useRef(0);
  const voiceHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceAnswerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const dayKey = localDayKey();
  const currentItem = objects[roundIndex % objects.length] ?? objects[0]!;

  const safeVoiceList = familyVoices.length > 0 ? familyVoices : DEFAULT_FAMILY_VOICES;
  const currentVoice = safeVoiceList[voiceRoundIndex % safeVoiceList.length] ?? safeVoiceList[0]!;

  // Initial data loading
  useEffect(() => {
    setReminderState(loadReminderState(dayKey));
    setSessionData(loadSessionData(dayKey));
    setWeeklyActivity(getWeeklyActivity());
    setFamilyVoices(loadFamilyVoices());

    const browserWindow = window as BrowserWindow;
    setVoiceSupported(Boolean(browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition));

    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      if (answerTimerRef.current) clearTimeout(answerTimerRef.current);
      if (voiceHintTimerRef.current) clearTimeout(voiceHintTimerRef.current);
      if (voiceAnswerTimerRef.current) clearTimeout(voiceAnswerTimerRef.current);
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      recognitionRef.current?.stop();
    };
  }, [dayKey]);

  // Play tab: Only run timers & speech once gameStarted is TRUE
  useEffect(() => {
    if (!gameStarted) {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      return;
    }

    roundStartedAt.current = Date.now();
    setHintVisible(false);
    setFeedback(null);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => {
      setHintVisible(true);
      speak(currentItem.hint);
    }, 7000);

    const welcomeTimer = setTimeout(() => speak(currentItem.prompt), 450);
    return () => clearTimeout(welcomeTimer);
  }, [currentItem, gameStarted]);

  // Advance round in Look & Speak
  useEffect(() => {
    if (feedback !== "success") return;
    answerTimerRef.current = setTimeout(() => {
      setRoundIndex((index) => (index + 1) % objects.length);
    }, 1700);
    return () => {
      if (answerTimerRef.current) clearTimeout(answerTimerRef.current);
    };
  }, [feedback]);

  // Play voice for Family Voices
  const playCurrentVoice = useCallback(() => {
    if (typeof window === "undefined") return;
    window.speechSynthesis?.cancel();
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    if (currentVoice.audioData) {
      const audio = new Audio(currentVoice.audioData);
      currentAudioRef.current = audio;
      audio.play().catch(() => {
        speak(currentVoice.prompt, 0.86, currentVoice.speechPitch ?? 1.05);
      });
    } else {
      speak(currentVoice.prompt, 0.86, currentVoice.speechPitch ?? 1.05);
    }
  }, [currentVoice]);

  // Family Voices: Only run timers & audio once voiceGameStarted is TRUE
  useEffect(() => {
    if (!voiceGameStarted || isManagingVoices) {
      if (voiceHintTimerRef.current) clearTimeout(voiceHintTimerRef.current);
      return;
    }

    voiceRoundStartedAt.current = Date.now();
    setVoiceHintVisible(false);
    setVoiceFeedback(null);
    if (voiceHintTimerRef.current) clearTimeout(voiceHintTimerRef.current);
    voiceHintTimerRef.current = setTimeout(() => {
      setVoiceHintVisible(true);
      speak(currentVoice.hint);
    }, 8000);

    const playTimer = setTimeout(() => {
      playCurrentVoice();
    }, 450);

    return () => {
      clearTimeout(playTimer);
      if (voiceHintTimerRef.current) clearTimeout(voiceHintTimerRef.current);
    };
  }, [currentVoice, voiceGameStarted, isManagingVoices, playCurrentVoice]);

  // Advance round in Family Voices
  useEffect(() => {
    if (voiceFeedback !== "success") return;
    voiceAnswerTimerRef.current = setTimeout(() => {
      setVoiceRoundIndex((index) => (index + 1) % safeVoiceList.length);
    }, 1800);
    return () => {
      if (voiceAnswerTimerRef.current) clearTimeout(voiceAnswerTimerRef.current);
    };
  }, [voiceFeedback, safeVoiceList.length]);

  // Handle Look & Speak answer
  const handleAnswer = useCallback(
    (answer: string) => {
      if (feedback === "success") return;

      if (isCorrectMemoryAnswer(answer, currentItem.aliases)) {
        const latencySeconds = roundStartedAt.current
          ? (Date.now() - roundStartedAt.current) / 1000
          : 0;
        if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
        recognitionRef.current?.stop();
        setIsListening(false);
        setFeedback("success");
        speak("Wonderful! You remembered. Well done!", 0.92);
        recordSessionRound(latencySeconds, dayKey);
        const nextSession = loadSessionData(dayKey);
        setSessionData(nextSession);
        setWeeklyActivity(getWeeklyActivity());
      } else {
        setHintVisible(true);
        setFeedback("gentle");
        speak(currentItem.hint);
      }
    },
    [currentItem, dayKey, feedback],
  );

  // Handle Family Voices answer
  const handleVoiceAnswer = useCallback(
    (answer: string) => {
      if (voiceFeedback === "success") return;

      const acceptedAnswers = [
        currentVoice.name,
        currentVoice.relation,
        `${currentVoice.name} ${currentVoice.relation}`,
        `${currentVoice.relation} ${currentVoice.name}`,
        ...currentVoice.aliases,
      ];

      if (isCorrectMemoryAnswer(answer, acceptedAnswers)) {
        const latencySeconds = voiceRoundStartedAt.current
          ? (Date.now() - voiceRoundStartedAt.current) / 1000
          : 0;
        if (voiceHintTimerRef.current) clearTimeout(voiceHintTimerRef.current);
        recognitionRef.current?.stop();
        setIsVoiceListening(false);
        setVoiceFeedback("success");
        speak(`Wonderful! That is ${currentVoice.name}. Lovely remembering!`, 0.92);
        recordSessionRound(latencySeconds, dayKey);
        const nextSession = loadSessionData(dayKey);
        setSessionData(nextSession);
        setWeeklyActivity(getWeeklyActivity());
      } else {
        setVoiceHintVisible(true);
        setVoiceFeedback("gentle");
        speak(currentVoice.hint);
      }
    },
    [currentVoice, dayKey, voiceFeedback],
  );

  const startListening = () => {
    const browserWindow = window as BrowserWindow;
    const SpeechRecognition = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
      setHintVisible(true);
      speak(currentItem.hint);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) handleAnswer(transcript);
    };
    recognition.onerror = () => {
      setIsListening(false);
      setHintVisible(true);
      speak(currentItem.hint);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
      setHintVisible(true);
      speak(currentItem.hint);
    }
  };

  const startVoiceListening = () => {
    const browserWindow = window as BrowserWindow;
    const SpeechRecognition = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
      setVoiceHintVisible(true);
      speak(currentVoice.hint);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) handleVoiceAnswer(transcript);
    };
    recognition.onerror = () => {
      setIsVoiceListening(false);
      setVoiceHintVisible(true);
      speak(currentVoice.hint);
    };
    recognition.onend = () => setIsVoiceListening(false);
    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsVoiceListening(true);
    } catch {
      setIsVoiceListening(false);
      setVoiceHintVisible(true);
      speak(currentVoice.hint);
    }
  };

  // Audio Recording for Custom Family Voice
  const startRecordingAudio = async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      alert("Microphone recording is not supported on this device. You can still save the greeting with voice simulation.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          setRecordedAudioUrl(reader.result as string);
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingAudio(true);
      setRecordingSeconds(0);
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setIsRecordingAudio(false);
      alert("Unable to access microphone. Please check permissions.");
    }
  };

  const stopRecordingAudio = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    }
  };

  const handleSaveCustomVoice = () => {
    if (!newMemberName.trim()) return;
    const newVoice: FamilyVoiceItem = {
      id: `voice-${Date.now()}`,
      name: newMemberName.trim(),
      relation: newMemberRelation.trim() || "Family Member",
      prompt: newMemberPrompt.trim() || `Hello! It is ${newMemberName.trim()} speaking to you!`,
      hint: `This is your loving ${newMemberRelation.trim() || "family member"} ${newMemberName.trim()}.`,
      aliases: [
        newMemberName.toLowerCase().trim(),
        newMemberRelation.toLowerCase().trim(),
      ].filter(Boolean),
      audioData: recordedAudioUrl || undefined,
      speechPitch: 1.05,
    };
    const updated = [...safeVoiceList, newVoice];
    setFamilyVoices(updated);
    saveFamilyVoices(updated);
    setNewMemberName("");
    setNewMemberRelation("");
    setNewMemberPrompt("");
    setRecordedAudioUrl(null);
    setRecordingSeconds(0);
  };

  const handleDeleteVoice = (id: string) => {
    const updated = safeVoiceList.filter((v) => v.id !== id);
    const finalVoices = updated.length > 0 ? updated : DEFAULT_FAMILY_VOICES;
    setFamilyVoices(finalVoices);
    saveFamilyVoices(finalVoices);
  };

  const handleResetVoices = () => {
    setFamilyVoices(DEFAULT_FAMILY_VOICES);
    saveFamilyVoices(DEFAULT_FAMILY_VOICES);
  };

  const toggleReminder = (id: ReminderKey) => {
    setReminderState((state) => {
      const nextState = { ...state, [id]: !state[id] };
      saveReminderState(nextState, dayKey);
      return nextState;
    });
  };

  const toggleVoiceAlarm = (next: boolean) => {
    setVoiceAlarm(next);
    if (next) speak("Voice reminders are on. We will gently say each reminder out loud.");
  };

  const correctItem = currentItem;
  const alternateItem = objects[(roundIndex + 1) % objects.length] ?? currentItem;

  const otherVoices = safeVoiceList.filter((v) => v.id !== currentVoice.id);
  const familyChoices = [currentVoice, ...otherVoices.slice(0, 1)].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const activityMax = Math.max(1, ...weeklyActivity.map((day) => day.rounds));
  const averageResponse = sessionData.rounds.length
    ? sessionData.rounds.reduce((total, round) => total + round.latencySeconds, 0) /
      sessionData.rounds.length
    : 0;
  const activeDays = weeklyActivity.filter((day) => day.rounds > 0).length;
  const consistency = Math.round((activeDays / 7) * 100);

  return (
    <div className="mindcare-app min-h-screen bg-background text-foreground">
      <header className="app-header">
        <div className="header-inner">
          <div className="brand-mark" aria-hidden="true">
            <HeartHandshake size={25} strokeWidth={2.3} />
          </div>
          <div className="brand-copy">
            <span className="brand-name">MindCare <span>NER</span></span>
            <span className="brand-subtitle">A little care, every day</span>
          </div>
          <div className="header-end">
            {installed ? (
              <span className="installed-status"><CheckCircle2 size={19} /> Ready offline</span>
            ) : (
              <span className="privacy-topline"><LockKeyhole size={17} /> Private by design</span>
            )}
          </div>
        </div>
      </header>

      <main className="main-content">
        {/* Tab 1: Play & Learn */}
        {tab === "play" && (
          <section className="play-view" aria-labelledby="game-title">
            <div className="page-intro play-intro">
              <div>
                <p className="eyebrow"><span className="eyebrow-dot" /> A MOMENT TOGETHER</p>
                <h1 id="game-title">Look &amp; Speak</h1>
                <p className="intro-copy">A little memory game, with familiar things from home.</p>
              </div>
              <div className="score-pill" aria-label={`${sessionData.rounds.length} memories remembered today`}>
                <Sparkles size={20} /> <span><strong>{sessionData.rounds.length}</strong> <small>remembered</small></span>
              </div>
            </div>

            {!gameStarted ? (
              <div className="memory-card start-card">
                <div className="memory-card-topline">
                  <span className="round-label"><span className="round-dot" /> TODAY’S GENTLE CHALLENGE</span>
                  <span className="round-count">{objects.length} familiar items</span>
                </div>
                <div className="start-hero">
                  <div className="start-hero-icon"><Sparkles size={36} /></div>
                  <h2>Ready to remember together?</h2>
                  <p>We will look at familiar objects from home and gently recall their names. There is no rush — tap below when you are ready to begin.</p>
                </div>
                <div className="start-action-row">
                  <button
                    type="button"
                    className="start-play-btn"
                    onClick={() => {
                      setGameStarted(true);
                      roundStartedAt.current = Date.now();
                      speak(currentItem.prompt);
                    }}
                  >
                    <Play size={24} fill="currentColor" />
                    <span>Start Look &amp; Speak</span>
                  </button>
                </div>
                <p className="gentle-footer"><HeartHandshake size={19} /> Take your time. You can speak or tap a picture.</p>
              </div>
            ) : (
              <div className={`memory-card${feedback === "success" ? " is-celebrating" : ""}`}>
                <div className="memory-card-topline">
                  <span className="round-label"><span className="round-dot" /> TODAY’S LITTLE CHALLENGE</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span className="round-count">{String((roundIndex % objects.length) + 1).padStart(2, "0")} <span>/ {String(objects.length).padStart(2, "0")}</span></span>
                    <button
                      type="button"
                      className="pause-pill"
                      onClick={() => {
                        setGameStarted(false);
                        window.speechSynthesis?.cancel();
                        recognitionRef.current?.stop();
                      }}
                      title="Pause practice"
                    >
                      <RotateCcw size={13} /> Pause
                    </button>
                  </div>
                </div>

                <div className="memory-photo-frame">
                  <div className="photo-caption-chip"><Sun size={16} /> A familiar thing</div>
                  <img
                    className="memory-photo"
                    src={currentItem.image}
                    alt="A clear photograph of a familiar object from North Eastern India"
                    width={1024}
                    height={1024}
                  />
                  {feedback === "success" && (
                    <div className="success-photo-stamp" aria-live="polite"><Sparkles size={22} /> Lovely remembering!</div>
                  )}
                </div>

                <div className="memory-prompt">
                  <div className="prompt-icon"><Volume2 size={21} /></div>
                  <div>
                    <p className="prompt-title">Take your time</p>
                    <p className="prompt-question">What is this called?</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="speak-again-button"
                    aria-label="Hear the question again"
                    onClick={() => speak(currentItem.prompt)}
                  >
                    <Volume2 size={22} />
                    <span>Hear again</span>
                  </Button>
                </div>

                <div className="voice-area">
                  <Button
                    type="button"
                    className={`mic-button${isListening ? " mic-listening" : ""}`}
                    aria-label={isListening ? "Listening now" : "Tap to answer aloud"}
                    onClick={isListening ? () => recognitionRef.current?.stop() : startListening}
                    disabled={feedback === "success"}
                  >
                    {isListening ? <MicOff size={29} /> : <Mic size={29} />}
                  </Button>
                  <p className="voice-label" aria-live="polite">
                    {isListening ? "I’m listening…" : voiceSupported ? "Tap to say the name" : "You can say it, or tap a picture"}
                  </p>
                  {hintVisible && feedback !== "success" && (
                    <p className="hint-line" role="status"><Info size={18} /> {currentItem.hint}</p>
                  )}
                  {feedback === "gentle" && (
                    <button
                      type="button"
                      className="gentle-try-again"
                      onClick={() => setFeedback(null)}
                    >
                      That’s okay. Let’s try together <ArrowRight size={18} />
                    </button>
                  )}
                </div>

                <div className="choice-divider"><span>OR TAP A PICTURE</span></div>
                <div className="picture-choices" aria-label="Choose the item you see">
                  {[correctItem, alternateItem]
                    .sort((left, right) => left.id.localeCompare(right.id))
                    .map((item) => (
                      <Button
                        key={item.id}
                        type="button"
                        variant="outline"
                        className="picture-choice"
                        aria-label={`This is ${item.name}`}
                        onClick={() => handleAnswer(item.name)}
                        disabled={feedback === "success"}
                      >
                        <img src={item.image} alt="" loading="lazy" width={1024} height={1024} />
                        <span>{item.name}</span>
                        <span className="choice-mark" aria-hidden="true"><ArrowRight size={20} /></span>
                      </Button>
                    ))}
                </div>
              </div>
            )}

            <p className="gentle-footer"><HeartHandshake size={19} /> Every moment is a good moment to remember.</p>
          </section>
        )}

        {/* Tab 2: Family Voices */}
        {tab === "voices" && (
          <section className="voices-view" aria-labelledby="voices-title">
            <div className="page-intro">
              <div>
                <p className="eyebrow"><span className="eyebrow-dot" /> HEAR LOVED ONES</p>
                <h1 id="voices-title">Family voices</h1>
                <p className="intro-copy">Listen to familiar voices and remember the warmth of family.</p>
              </div>
              <button
                type="button"
                className="voice-manage-toggle"
                onClick={() => setIsManagingVoices((prev) => !prev)}
                aria-expanded={isManagingVoices}
              >
                <Users size={18} />
                <span>{isManagingVoices ? "Back to game" : "Manage voices"}</span>
              </button>
            </div>

            {isManagingVoices ? (
              <div className="voice-management-panel">
                <h2>Record &amp; Add Family Voices</h2>
                <p className="sub">Record real family member voices so your loved one can hear them anytime.</p>

                <div className="manage-form-grid">
                  <div className="manage-input-row">
                    <label htmlFor="member-name">Family Member’s Name</label>
                    <input
                      id="member-name"
                      type="text"
                      className="manage-input"
                      placeholder="e.g., Priya"
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                    />
                  </div>

                  <div className="manage-input-row">
                    <label htmlFor="member-relation">Relationship</label>
                    <input
                      id="member-relation"
                      type="text"
                      className="manage-input"
                      placeholder="e.g., Granddaughter / Son / Sister"
                      value={newMemberRelation}
                      onChange={(e) => setNewMemberRelation(e.target.value)}
                    />
                  </div>

                  <div className="manage-input-row">
                    <label htmlFor="member-prompt">Voice Greeting / Question</label>
                    <input
                      id="member-prompt"
                      type="text"
                      className="manage-input"
                      placeholder="e.g., Good morning Dadu! Have you had your tea?"
                      value={newMemberPrompt}
                      onChange={(e) => setNewMemberPrompt(e.target.value)}
                    />
                  </div>
                </div>

                <div className="record-controls-row">
                  {isRecordingAudio ? (
                    <Button
                      type="button"
                      className="record-btn record-btn-active"
                      onClick={stopRecordingAudio}
                    >
                      <Square size={18} />
                      <span>Stop recording ({recordingSeconds}s)</span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      className="record-btn"
                      variant="outline"
                      onClick={startRecordingAudio}
                    >
                      <Mic size={18} />
                      <span>{recordedAudioUrl ? "Re-record voice" : "Record voice (Microphone)"}</span>
                    </Button>
                  )}

                  {recordedAudioUrl && (
                    <Button
                      type="button"
                      variant="secondary"
                      className="record-btn"
                      onClick={() => {
                        const testAudio = new Audio(recordedAudioUrl);
                        testAudio.play().catch(() => {});
                      }}
                    >
                      <Volume2 size={18} />
                      <span>Test playback</span>
                    </Button>
                  )}

                  <Button
                    type="button"
                    className="record-btn"
                    style={{ marginLeft: "auto", background: "var(--care-navy)", color: "#fff" }}
                    onClick={handleSaveCustomVoice}
                    disabled={!newMemberName.trim()}
                  >
                    <Check size={18} />
                    <span>Save family voice</span>
                  </Button>
                </div>

                <div style={{ marginTop: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "900", color: "var(--care-navy)" }}>Configured Voices ({safeVoiceList.length})</h3>
                    <button
                      type="button"
                      style={{ background: "transparent", border: 0, color: "var(--care-blue)", fontSize: "13px", fontWeight: "800", cursor: "pointer" }}
                      onClick={handleResetVoices}
                    >
                      Reset to defaults
                    </button>
                  </div>
                  <div className="voice-item-list">
                    {safeVoiceList.map((voice) => (
                      <div key={voice.id} className="voice-item-row">
                        <div className="voice-item-detail">
                          <strong>{voice.name} ({voice.relation})</strong>
                          <span>"{voice.prompt}" {voice.audioData ? "• 🎙️ Recorded Audio" : "• 🗣️ Synthesized Voice"}</span>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (voice.audioData) {
                                new Audio(voice.audioData).play().catch(() => {});
                              } else {
                                speak(voice.prompt, 0.86, voice.speechPitch ?? 1.05);
                              }
                            }}
                          >
                            <Volume2 size={16} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            style={{ color: "var(--care-red)" }}
                            onClick={() => handleDeleteVoice(voice.id)}
                            disabled={safeVoiceList.length <= 1}
                            title="Delete voice"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : !voiceGameStarted ? (
              <div className="memory-card start-card">
                <div className="memory-card-topline">
                  <span className="round-label"><span className="round-dot" /> FAMILY VOICE RECALL</span>
                  <span className="round-count">{safeVoiceList.length} voices ready</span>
                </div>
                <div className="start-hero">
                  <div className="start-hero-icon" style={{ background: "oklch(0.95 0.035 33)", color: "var(--care-red)" }}><HeartHandshake size={36} /></div>
                  <h2>Listen to familiar voices</h2>
                  <p>A loving family member has a message for you. Listen to their voice and see if you can remember who is speaking.</p>
                </div>
                <div className="start-action-row">
                  <button
                    type="button"
                    className="start-play-btn"
                    onClick={() => {
                      setVoiceGameStarted(true);
                      voiceRoundStartedAt.current = Date.now();
                      playCurrentVoice();
                    }}
                  >
                    <Play size={24} fill="currentColor" />
                    <span>Start Listening</span>
                  </button>
                </div>
                <p className="gentle-footer"><HeartHandshake size={19} /> You can say their name aloud or tap their card.</p>
              </div>
            ) : (
              <div className={`memory-card${voiceFeedback === "success" ? " is-celebrating" : ""}`}>
                <div className="memory-card-topline">
                  <span className="round-label"><span className="round-dot" /> WHO IS SPEAKING?</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span className="round-count">{String((voiceRoundIndex % safeVoiceList.length) + 1).padStart(2, "0")} <span>/ {String(safeVoiceList.length).padStart(2, "0")}</span></span>
                    <button
                      type="button"
                      className="pause-pill"
                      onClick={() => {
                        setVoiceGameStarted(false);
                        window.speechSynthesis?.cancel();
                        if (currentAudioRef.current) currentAudioRef.current.pause();
                        recognitionRef.current?.stop();
                      }}
                      title="Pause practice"
                    >
                      <RotateCcw size={13} /> Pause
                    </button>
                  </div>
                </div>

                <div className="voice-avatar-frame">
                  <div className="voice-avatar-circle">
                    <Volume2 size={44} />
                  </div>
                  <div className="voice-prompt-bubble">
                    <p style={{ margin: "0 0 6px", fontSize: "14px", color: "var(--muted-foreground)", fontWeight: 700 }}>Listen carefully...</p>
                    <p style={{ margin: 0, fontSize: "18px", color: "var(--care-navy)", fontWeight: 900 }}>"{currentVoice.prompt}"</p>
                  </div>
                  <Button
                    type="button"
                    className="voice-play-huge-btn"
                    onClick={playCurrentVoice}
                  >
                    <Volume2 size={20} />
                    <span>Hear voice again</span>
                  </Button>
                  {voiceFeedback === "success" && (
                    <div className="success-photo-stamp" aria-live="polite"><Sparkles size={22} /> Lovely! It is {currentVoice.name}!</div>
                  )}
                </div>

                <div className="memory-prompt">
                  <div className="prompt-icon"><UserCheck size={21} /></div>
                  <div>
                    <p className="prompt-title">Take your time</p>
                    <p className="prompt-question">Who is speaking to you?</p>
                  </div>
                </div>

                <div className="voice-area">
                  <Button
                    type="button"
                    className={`mic-button${isVoiceListening ? " mic-listening" : ""}`}
                    aria-label={isVoiceListening ? "Listening now" : "Tap to answer aloud"}
                    onClick={isVoiceListening ? () => recognitionRef.current?.stop() : startVoiceListening}
                    disabled={voiceFeedback === "success"}
                  >
                    {isVoiceListening ? <MicOff size={29} /> : <Mic size={29} />}
                  </Button>
                  <p className="voice-label" aria-live="polite">
                    {isVoiceListening ? "I’m listening…" : voiceSupported ? "Say their name or relation" : "You can say their name, or tap below"}
                  </p>
                  {voiceHintVisible && voiceFeedback !== "success" && (
                    <p className="hint-line" role="status"><Info size={18} /> {currentVoice.hint}</p>
                  )}
                  {voiceFeedback === "gentle" && (
                    <button
                      type="button"
                      className="gentle-try-again"
                      onClick={() => setVoiceFeedback(null)}
                    >
                      That’s okay. Let’s try together <ArrowRight size={18} />
                    </button>
                  )}
                </div>

                <div className="choice-divider"><span>OR TAP THEIR NAME</span></div>
                <div className="family-choices" aria-label="Choose the family member speaking">
                  {familyChoices.map((item) => (
                    <Button
                      key={item.id}
                      type="button"
                      variant="outline"
                      className="family-choice-btn"
                      onClick={() => handleVoiceAnswer(item.name)}
                      disabled={voiceFeedback === "success"}
                    >
                      <div className="family-choice-avatar">
                        {item.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="family-choice-info">
                        <strong>{item.name}</strong>
                        <span>{item.relation}</span>
                      </div>
                      <span className="choice-mark" aria-hidden="true"><ArrowRight size={20} /></span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <p className="gentle-footer"><HeartHandshake size={19} /> The voices of family are always close to your heart.</p>
          </section>
        )}

        {/* Tab 3: Reminders */}
        {tab === "reminders" && (
          <section className="reminders-view" aria-labelledby="reminders-title">
            <div className="page-intro">
              <div>
                <p className="eyebrow"><span className="eyebrow-dot" /> YOUR DAY, GENTLY</p>
                <h1 id="reminders-title">Daily reminders</h1>
                <p className="intro-copy">Small things to keep you feeling well.</p>
              </div>
              <div className="today-chip"><Clock3 size={19} /><span>{new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span></div>
            </div>

            <div className="reminder-list">
              {reminders.map(({ id, label, time, detail, icon: Icon, color }) => (
                <article className={`reminder-row reminder-${color}${reminderState[id] ? " reminder-done" : ""}`} key={id}>
                  <div className="reminder-icon-wrap" aria-hidden="true"><Icon size={30} strokeWidth={1.9} /></div>
                  <div className="reminder-copy">
                    <span className="reminder-time">{time}</span>
                    <h2>{label}</h2>
                    <p>{reminderState[id] ? "All done for now. Well done." : detail}</p>
                  </div>
                  <Button
                    type="button"
                    variant={reminderState[id] ? "secondary" : "default"}
                    className="taken-button"
                    aria-label={reminderState[id] ? `Mark ${label} as not taken` : `Mark ${label} as taken`}
                    aria-pressed={Boolean(reminderState[id])}
                    onClick={() => toggleReminder(id)}
                  >
                    {reminderState[id] ? <><CheckCircle2 size={21} /> Taken</> : <><Check size={21} /> Taken</>}
                  </Button>
                </article>
              ))}
            </div>

            <div className="voice-reminder-setting">
              <div className="voice-setting-icon"><BellRing size={24} /></div>
              <div className="voice-setting-copy">
                <h2>Voice reminder practice</h2>
                <p>{voiceAlarm ? "Gentle voice reminders are on." : "Hear a reminder spoken out loud."}</p>
              </div>
              <Switch
                checked={voiceAlarm}
                onCheckedChange={toggleVoiceAlarm}
                aria-label="Voice reminder simulation"
                className="voice-switch"
              />
            </div>

            <div className="local-note"><LockKeyhole size={19} /><p>Your reminders stay on this device and begin fresh each day.</p></div>
          </section>
        )}

        {/* Tab 4: Caregiver Dashboard */}
        {tab === "dashboard" && (
          <section className="dashboard-view" aria-labelledby="dashboard-title">
            <div className="page-intro">
              <div>
                <p className="eyebrow"><span className="eyebrow-dot" /> A FAMILY CHECK-IN</p>
                <h1 id="dashboard-title">Caregiver view</h1>
                <p className="intro-copy">A gentle look at today’s moments together.</p>
              </div>
              <div className="family-avatar" aria-hidden="true"><HeartHandshake size={26} /></div>
            </div>

            <div className="metric-grid" aria-label="Memory game engagement">
              <article className="metric-tile metric-blue">
                <span className="metric-icon"><Play size={21} /></span>
                <span className="metric-number">{sessionData.rounds.length}</span>
                <span className="metric-caption">Games today</span>
              </article>
              <article className="metric-tile metric-red">
                <span className="metric-icon"><Clock3 size={21} /></span>
                <span className="metric-number">{sessionData.rounds.length ? `${averageResponse.toFixed(1)}s` : "—"}</span>
                <span className="metric-caption">Time to answer</span>
              </article>
              <article className="metric-tile metric-green">
                <span className="metric-icon"><Activity size={21} /></span>
                <span className="metric-number">{consistency}%</span>
                <span className="metric-caption">Weekly consistency</span>
              </article>
            </div>

            <article className="weekly-panel">
              <div className="panel-heading">
                <div><span className="panel-kicker">THE PAST 7 DAYS</span><h2>Little moments add up</h2></div>
                <span className="week-total"><Sparkles size={17} /> {weeklyActivity.reduce((total, day) => total + day.rounds, 0)} plays</span>
              </div>
              <div className="weekly-bars" role="img" aria-label={weeklyActivity.map((day) => `${day.day}: ${day.rounds} games`).join(", ")}>
                {weeklyActivity.map((day) => (
                  <div className="weekly-bar-column" key={day.key}>
                    <span className="weekly-count">{day.rounds || "·"}</span>
                    <div className="weekly-bar-track"><div className="weekly-bar-fill" style={{ height: `${day.rounds ? Math.max(15, (day.rounds / activityMax) * 100) : 5}%` }} /></div>
                    <span className="weekly-day">{day.day}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="alertness-panel">
              <div className="panel-heading">
                <div><span className="panel-kicker">A GENTLE DAILY RHYTHM</span><h2>Time for favourite things</h2></div>
                <Sun className="sun-icon" size={27} />
              </div>
              <p className="rhythm-copy">An example of how energy can change through the day. Every day is different.</p>
              <div className="rhythm-line">
                <div className="rhythm-item rhythm-morning"><span className="rhythm-dot" /><div><strong>Morning</strong><span>Often a bright time to play</span></div><span className="rhythm-value">9 AM</span></div>
                <div className="rhythm-divider" />
                <div className="rhythm-item rhythm-evening"><span className="rhythm-dot" /><div><strong>Evening</strong><span>A quieter time to rest</span></div><span className="rhythm-value">7 PM</span></div>
              </div>
              <div className="chart-key"><span><i className="key-morning" /> Alert moments</span><span><i className="key-evening" /> Gentle rest</span></div>
            </article>

            <div className="privacy-badge">
              <span className="privacy-icon"><LockKeyhole size={23} /></span>
              <div><h2>100% privacy-first</h2><p>Zero personal family photos or private cloud data required.</p></div>
              <CheckCircle2 className="privacy-check" size={22} />
            </div>

            <div className="care-note"><Info size={19} /><p>This companion is for gentle practice and is not a medical assessment.</p></div>
          </section>
        )}
      </main>

      {/* 4 Bottom Navigation Tabs */}
      <nav className="bottom-nav" aria-label="Main navigation">
        <Button
          type="button"
          variant="ghost"
          className={`nav-tab${tab === "play" ? " nav-tab-active" : ""}`}
          aria-current={tab === "play" ? "page" : undefined}
          onClick={() => {
            setTab("play");
            window.speechSynthesis?.cancel();
            if (currentAudioRef.current) currentAudioRef.current.pause();
          }}
        >
          <span className="nav-icon"><Play size={22} fill="currentColor" /></span>
          <span>Play &amp; Learn</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={`nav-tab${tab === "voices" ? " nav-tab-active" : ""}`}
          aria-current={tab === "voices" ? "page" : undefined}
          onClick={() => {
            setTab("voices");
            window.speechSynthesis?.cancel();
            if (currentAudioRef.current) currentAudioRef.current.pause();
          }}
        >
          <span className="nav-icon"><Users size={22} /></span>
          <span>Family voices</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={`nav-tab${tab === "reminders" ? " nav-tab-active" : ""}`}
          aria-current={tab === "reminders" ? "page" : undefined}
          onClick={() => {
            setTab("reminders");
            window.speechSynthesis?.cancel();
            if (currentAudioRef.current) currentAudioRef.current.pause();
          }}
        >
          <span className="nav-icon"><Clock3 size={22} /></span>
          <span>Reminders</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={`nav-tab${tab === "dashboard" ? " nav-tab-active" : ""}`}
          aria-current={tab === "dashboard" ? "page" : undefined}
          onClick={() => {
            setTab("dashboard");
            window.speechSynthesis?.cancel();
            if (currentAudioRef.current) currentAudioRef.current.pause();
          }}
        >
          <span className="nav-icon"><Activity size={22} /></span>
          <span>Family view</span>
        </Button>
      </nav>
    </div>
  );
}
