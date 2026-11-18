import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  BellRing,
  Check,
  CheckCircle2,
  Clock3,
  HeartHandshake,
  Info,
  LockKeyhole,
  Mic,
  MicOff,
  Pill,
  Play,
  Sparkles,
  Sun,
  Volume2,
  Waves,
  Footprints,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import bambooBasketImage from "@/assets/bamboo-basket.jpg";
import gamosaImage from "@/assets/gamosa.jpg";
import japiHatImage from "@/assets/japi-hat.jpg";
import lalChaImage from "@/assets/lal-cha.jpg";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  getWeeklyActivity,
  isCorrectMemoryAnswer,
  loadReminderState,
  loadSessionData,
  localDayKey,
  recordSessionRound,
  saveReminderState,
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
          "A gentle, private memory companion with regional object recall, daily care reminders, and a family check-in view.",
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

type Tab = "play" | "reminders" | "dashboard";

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

function speak(text: string, rate = 0.86) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-IN";
  utterance.rate = rate;
  utterance.pitch = 1.02;
  window.speechSynthesis.speak(utterance);
}

function MindCare() {
  const [tab, setTab] = useState<Tab>("play");
  const [roundIndex, setRoundIndex] = useState(0);
  const [hintVisible, setHintVisible] = useState(false);
  const [feedback, setFeedback] = useState<"success" | "gentle" | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [reminderState, setReminderState] = useState<ReminderState>({});
  const [voiceAlarm, setVoiceAlarm] = useState(false);
  const [sessionData, setSessionData] = useState<SessionData>({ rounds: [] });
  const [weeklyActivity, setWeeklyActivity] = useState<ReturnType<typeof getWeeklyActivity>>([]);
  const [installed, setInstalled] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);
  const roundStartedAt = useRef(0);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dayKey = localDayKey();
  const currentItem = objects[roundIndex % objects.length] ?? objects[0]!;


  useEffect(() => {
    setReminderState(loadReminderState(dayKey));
    setSessionData(loadSessionData(dayKey));
    setWeeklyActivity(getWeeklyActivity());
    const browserWindow = window as BrowserWindow;
    setVoiceSupported(Boolean(browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition));

    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      if (answerTimerRef.current) clearTimeout(answerTimerRef.current);
      recognitionRef.current?.stop();
    };
  }, [dayKey]);

  useEffect(() => {
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
  }, [currentItem]);

  useEffect(() => {
    if (feedback !== "success") return;
    answerTimerRef.current = setTimeout(() => {
      setRoundIndex((index) => (index + 1) % objects.length);
    }, 1700);
    return () => {
      if (answerTimerRef.current) clearTimeout(answerTimerRef.current);
    };
  }, [feedback]);

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

            <div className={`memory-card${feedback === "success" ? " is-celebrating" : ""}`}>
              <div className="memory-card-topline">
                <span className="round-label"><span className="round-dot" /> TODAY’S LITTLE CHALLENGE</span>
                <span className="round-count">{String((roundIndex % objects.length) + 1).padStart(2, "0")} <span>/ {String(objects.length).padStart(2, "0")}</span></span>
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

            <p className="gentle-footer"><HeartHandshake size={19} /> Every moment is a good moment to remember.</p>
          </section>
        )}

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

      <nav className="bottom-nav" aria-label="Main navigation">
        <Button
          type="button"
          variant="ghost"
          className={`nav-tab${tab === "play" ? " nav-tab-active" : ""}`}
          aria-current={tab === "play" ? "page" : undefined}
          onClick={() => setTab("play")}
        ><span className="nav-icon"><Play size={22} fill="currentColor" /></span><span>Play &amp; Learn</span></Button>
        <Button
          type="button"
          variant="ghost"
          className={`nav-tab${tab === "reminders" ? " nav-tab-active" : ""}`}
          aria-current={tab === "reminders" ? "page" : undefined}
          onClick={() => setTab("reminders")}
        ><span className="nav-icon"><Clock3 size={23} /></span><span>Reminders</span></Button>
        <Button
          type="button"
          variant="ghost"
          className={`nav-tab${tab === "dashboard" ? " nav-tab-active" : ""}`}
          aria-current={tab === "dashboard" ? "page" : undefined}
          onClick={() => setTab("dashboard")}
        ><span className="nav-icon"><Activity size={23} /></span><span>Family view</span></Button>
      </nav>
    </div>
  );
}