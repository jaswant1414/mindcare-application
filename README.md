# Mindful Memory Moments

Build a fully interactive, mobile-first Progressive Web App (PWA) prototype named "MindCare NER" — an offline-capable, voice-assisted cognitive health and memory companion tailored for elderly dementia patients in the North Eastern Region (NER) of India, featuring zero-PII privacy design and a caregiver tracking dashboard.

### 1. UI/UX & Design System (Elderly-First Accessibility)
- **Theme & Palette:** Warm cream background (#FAF6F0), deep navy headers (#1B365D), high-contrast accessibility buttons, and regional accent colors (Assamese/Naga traditional red and green).
- **Typography & Layout:** Extra-large fonts (minimum body text 18px, headers 28px+), oversized touch targets (minimum 64px height), and clutter-free "One Card per Screen" layout to prevent cognitive overload.
- **Navigation Bar:** Simple bottom tab bar with 4 accessible icons/labels: 🎮 "Play & Learn", 👥 "Family Voices", ⏰ "Daily Reminders", and 📊 "Caregiver Dashboard".

### 2. Live Game Modules
- **Module 1: "Look & Speak: NER Object Recall":**
  - **Start-Gate Control:** Initial screen waits for explicit user activation via oversized "Start Look & Speak" button before timers or audio prompts begin.
  - Displays high-contrast cards of familiar cultural items (Japi Hat, Lal Cha, Gamosa, Bamboo Basket).
  - Speech recognition with phonetic fuzzy matching + touch card fallbacks.
  - Zero-failure feedback loop with 7-second gentle audio clues.
- **Module 2: "Family Voices Recall":**
  - Dedicated navigation tab with custom family member voice greetings and questions.
  - **Caregiver Voice Studio:** Family members can record real audio messages using their microphone or customize synthetic greetings.
  - **Memory Gameplay ("Who is speaking to you?"):** Plays the recorded voice, allowing the elder to recognize their loved one by voice input or tapping large avatar cards.
  - 100% private: Audio recordings are stored in client-side browser storage (Zero cloud/PII upload).

### 3. Feature 2: Voice & Visual Daily Care Reminders
- A dedicated tab showing large, visual reminder cards for daily routines:
  - 💊 **Morning Medicine** (with a picture of a pill strip and a "Taken" check button).
  - 💧 **Hydration / Water** (with a water glass graphic).
  - 🚶 **Evening Walk / Doctor Visit**.
- Includes a toggle for "Voice Alarm Simulation" that speaks the reminder out loud in an Indian English / regional voice.

### 4. Feature 3: Caregiver Insights Dashboard
- A clean analytics tab designed for family members or ASHA health workers:
  - **Engagement Metrics:** Total games played today, average response hesitation latency (in seconds), and weekly consistency score.
  - **Sundowning / Fatigue Indicator:** A simple chart showing peak alertness hours versus evening fatigue.
  - **Privacy Badge:** A clear notice stating: *"100% Privacy-First: Zero personal family photos or private cloud data required."*

### 5. Technical Requirements
- Build as a single-page or multi-tab React app using Tailwind CSS for styling and `lucide-react` for icons.
- Implement state management using React `useState` and `useEffect` so game rounds advance smoothly, scores update live, and reminder checkboxes persist in browser local storage.
- Ensure fully responsive mobile layout that looks and feels like a native Android tablet/smartphone app.



## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
