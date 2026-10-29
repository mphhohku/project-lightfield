# project-lightfield
Lightfield: AI-powered Interactive Fieldwork for Enterprise Training Website

The Meaning: In computational photography, a light field captures a scene through an array of multiple microlenses simultaneously, allowing Anyone to refocus the image later.
Why use this name for the app: It is a 1:1 metaphor for the platform. The teammates examine an app through 3 Lenses (UX, Strategy, Payload) simultaneously, and because every session is saved to a .json file in the dropdown, anyone can revisit and "refocus" on a past session later.

The App Header: LIGHTFIELD // HKU AI Fieldwork & Knowledge Exchange
The JSON Session Dropdown: Call recorded sessions "Field Logs" (e.g., Field Log #01: The HKU Lunch Rotator [Live / Replay]).
The 3 Equal-Status Tracks: Call them "Field Lenses" or "Survey Roles" (Experience Lens, Grounding Lens, Payload Lens).
The Optional Homework / Sandbox: Call it "Field Testing" ("Grab a free API key and run your own Field Test before our next session").

Below is a complete, production-ready `project-plan.md` you can drop directly into the root of your repository. It frames your tool as a reusable **Enterprise Interactive Training & Knowledge Exchange Engine** that scales from 10-minute lightning talks to 2-hour workshops, complete with the JSON session recorder/replayer dropdown and the pilot **HKU AI Lunch Rotator** module.

```markdown
# Project Plan: PulseDeck — Interactive Enterprise AI Training & Knowledge Exchange Platform

## 1. Executive Summary & Vision
**PulseDeck** is a lightweight, zero-login, real-time interactive training platform built with **Node.js, TypeScript, Vite, and Vue 3**. Designed for cross-functional enterprise IT teams (spanning non-coding UI designers, user support specialists, middle managers, and software engineers), it unifies live presentation slides, real-time polls (Mentimeter-style), speed quizzes (Kahoot-style), and role-differentiated hands-on AI sandboxes into a single browser tab.

### Core Value Propositions
1. **Zero Friction (No Login Required):** Participants join via QR code or link and receive an auto-generated session UUID and an HKU-themed alias (e.g., `Pokfulam Panda`, `Centennial Owl`).
2. **JSON-Driven Session Recording & Replay Dropdown:** Every training session—including its curriculum blocks, live poll aggregates, quiz leaderboards, participant lab submissions, and grounded AI outputs—is serialized into a portable `.json` snapshot. A global header dropdown allows team members to revisit any past session, inspect team outputs, or run the hands-on sandbox asynchronously.
3. **Elastic Duration Scaling (10 Mins to 2 Hours):** Sessions are composed of modular JSON blocks (`POLL`, `QUIZ`, `CONCEPT`, `LAB_3_LENS`, `LIVE_SANDBOX`, `HOMEWORK`). A 15-minute knowledge exchange uses 4–5 core blocks, while a 2-hour workshop chains multiple deep-dive lab loops without changing a single line of platform code.
4. **3-Lens Horizontal Pedagogy:** Eliminates hierarchical labels ("Easy / Medium / Hard") in favor of equal-status **Architectural Lenses** so non-coders, managers, and developers learn side-by-side with immediate, role-relevant takeaways.
5. **BYOK & Proactive Dual-Grounded AI (`@google/genai`):** Supports Bring-Your-Own-Key (stored strictly in client `sessionStorage`) alongside pre-cached proactive datasets, utilizing Gemini 2.5 Flash with both **Google Maps Grounding** (`googleMaps`) and **Google Search Grounding** (`googleSearch`).

---

## 2. System Architecture & Tech Stack

### Tech Stack
* **Frontend:** Vue 3 (Composition API), Vite, TypeScript, Tailwind CSS, Pinia (state sync), Socket.io-client.
* **Backend:** Node.js, Fastify (or Express), Socket.io (real-time room/state broadcasting), TypeScript.
* **AI SDK:** Official `@google/genai` SDK (`gemini-2.5-flash` with `googleMaps` + `googleSearch` tools).
* **Persistence:** Zero-database file-system storage (`/server/data/sessions/*.json`). Live state is held in memory and automatically flushed to a timestamped JSON file upon each step transition or session end.

### Repository Structure
```text
pulsedeck-training/
├── client/                          # Vite + Vue 3 + TypeScript Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── header/
│   │   │   │   ├── SessionDropdown.vue     # Switch between Live & Archived JSON sessions
│   │   │   │   └── ByokKeyDrawer.vue       # Client-side sessionStorage Gemini API key input
│   │   │   ├── blocks/
│   │   │   │   ├── PollBlock.vue           # Menti-style live bar/word-cloud poll
│   │   │   │   ├── QuizBlock.vue           # Kahoot-style timed quiz + leaderboard
│   │   │   │   ├── ThreeLensLabBlock.vue   # Role-differentiated interactive worksheet
│   │   │   │   └── LunchRotatorWheel.vue   # Interactive Gacha Wheel + Grounding Citations
│   │   ├── stores/
│   │   │   └── sessionStore.ts             # Pinia store synced via WebSockets or JSON Archive
│   │   └── views/
│   │       ├── PresenterView.vue           # Projector screen with step controls & live synthesis
│   │       └── ParticipantView.vue         # Mobile/Laptop view (auto-morphs per active block)
├── server/                          # Node.js + TypeScript Backend
│   ├── src/
│   │   ├── services/
│   │   │   ├── geminiGrounding.ts          # @google/genai Maps + Search payload service
│   │   │   └── sessionRecorder.ts          # Reads/Writes session snapshots to JSON files
│   │   ├── scripts/
│   │   │   └── proactiveGather.ts          # CLI script to pre-fetch & cache grounded HKU data
│   │   └── index.ts                        # HTTP + Socket.io server
│   └── data/
│       ├── sessions/                       # Saved & Replayable Session JSON files
│       │   ├── 2026-10-29-lunch-rotator-live.json
│       │   ├── template-15min-lunch-gacha.json
│       │   └── template-120min-ai-architecture.json
│       └── cache/
│           └── hku-restaurants-fallback.json
└── project-plan.md
```

---

## 3. The JSON Session Recording & Replay Architecture

### How the Session Dropdown Works
In the top navigation bar, `<SessionDropdown />` queries `GET /api/sessions` to populate a categorized dropdown menu:
1. **🟢 Active Live Session:** Connects via WebSocket (`Socket.io`). As the presenter advances blocks, participants' screens update in real time and their interactions are recorded into the active server memory state.
2. **📁 Recorded Past Sessions (JSON Archives):** When a user selects a past session from the dropdown (e.g., *"2026-10-29: AI Lunch Rotator — Team Exchange #1"*), the frontend switches to **Replay & Self-Paced Mode**:
   * Users can freely click **Previous / Next Step** at their own pace.
   * All historical poll charts, quiz leaderboards, and colleague 3-Lens submissions from that day are rendered intact.
   * Users can still interact with the **Live Sandbox / Homework tabs** (using pre-cached data or their own BYOK key) without overwriting the historical JSON record.

### Unified Session JSON Schema (`TrainingSessionJSON`)
Every session—whether a blank template or a completed recording—adheres to a single TypeScript contract:

```typescript
export type LensType = 'EXPERIENCE_ARCHITECT' | 'GROUNDING_STRATEGIST' | 'PAYLOAD_ENGINEER';

export interface TrainingSessionJSON {
  sessionId: string;                  // e.g., "2026-10-29-hku-lunch-rotator"
  title: string;                      // Dropdown display title
  dateRecorded: string;               // ISO timestamp
  durationMode: '15_MIN' | '60_MIN' | '120_MIN';
  status: 'LIVE' | 'ARCHIVED' | 'TEMPLATE';
  presenterName: string;
  currentBlockIndex: number;

  // 1. Curriculum Blocks (Defines the flow of the training)
  blocks: Array<{
    id: string;
    type: 'POLL' | 'QUIZ' | 'CONCEPT' | 'LAB_3_LENS' | 'SANDBOX_SPIN' | 'HOMEWORK';
    title: string;
    durationMinutes: number;
    config: Record<string, any>;      // Questions, options, code blanks, or default filters
  }>;

  // 2. Recorded Session State (Saved during live run for permanent replay)
  recordedState: {
    participants: Record<string, {
      alias: string;                  // e.g., "SaiYingPun Noodle"
      selectedLens?: LensType;
      quizScore: number;
    }>;
    pollResults: Record<string, Record<string, number>>; // blockId -> { optionKey: voteCount }
    quizResults: Record<string, {
      leaderboard: Array<{ alias: string; score: number; timeMs: number }>;
    }>;
    labSubmissions: Array<{
      id: string;
      alias: string;
      lens: LensType;
      timestamp: string;
      payload: {
        vibePrompt?: string;          // Lens 1 output
        filterMatrix?: any;           // Lens 2 output
        codeSnippet?: any;            // Lens 3 output
      };
    }>;
    generatedArtifacts: Array<{       // Saved AI outputs + Maps/Search citations from the live demo
      timestamp: string;
      triggeredByGroup: string;
      filtersUsed: any;
      restaurants: any[];
      winningRestaurant: string;
      mapSources: Array<{ title: string; uri: string }>;
      webSources: Array<{ title: string; uri: string }>;
    }>;
  };
}
```

---

## 4. Elastic Time-Scaling Design (10 Mins to 2 Hours)

Because sessions are just arrays of blocks inside a JSON file, scaling from a lightning talk to a full workshop requires only toggling blocks in the JSON configuration:

| Feature / Block Type | Lightning Exchange (10–20 Mins) | Standard Brown-Bag (45–60 Mins) | Deep-Dive Workshop (90–120 Mins) |
| :--- | :--- | :--- | :--- |
| **Icebreaker Poll (`POLL`)** | 1 single-click poll (2 mins) | 2 polls + open word cloud (5 mins) | Multi-poll diagnostic + discussion (10 mins) |
| **Concept & Quiz (`QUIZ`)** | 2 speed questions (3 mins) | 4 questions + architecture breakdown (10 mins) | 2 quiz rounds across modules (20 mins) |
| **3-Lens Lab (`LAB_3_LENS`)** | 1 guided round with dropdown/blanks (8 mins) | 2 iterative rounds: Design $\rightarrow$ Edge-case stress test (25 mins) | Full cross-functional sprint: Wireframing, Schema design, & Live API coding (60 mins) |
| **Live Synthesis (`SANDBOX_SPIN`)** | Spin 1 triad's configuration live (4 mins) | Test 3 groups' configs + compare grounding logs (15 mins) | Live hackathon showcase where every triad demos their custom rotator (25 mins) |
| **Takeaway (`HOMEWORK`)** | 1-click Cheat Sheet export + asynchronous BYOK challenge (1 min) | Guided 5-min setup of BYOK sandbox | In-session peer review + exportable production microservice template (5 mins) |

---

## 5. Pedagogical Framework: The 3-Lens Equal-Status Design

To address the wide skill gap in the room (UI designers, user support, veteran middle managers, and junior developers) without creating an "Easy / Medium / Hard" hierarchy, every lab block presents three horizontal **Architectural Lenses**:

1. **Lens A: Experience & Serendipity Designer *(Targeted at UI/UX, User Support, Non-Coders)***
   * **Focus:** Human-centered prompt design, persona tone, emotional triggers, and defensive UX (handling empty states, "re-spin" fatigue, or bad inputs).
   * **Immediate Takeaway:** A reusable template for writing defensive system instructions and AI UX states.
2. **Lens B: Filter & Grounding Strategist *(Targeted at Middle Managers, Analysts, Product Owners)***
   * **Focus:** Business constraints, parameter taxonomy (budget, walking radius, weather/slope constraints), and deciding which data points require **Google Maps** vs. **Google Search** verification to prevent hallucinations.
   * **Immediate Takeaway:** An AI Feature Scoping & Grounding Matrix usable for evaluating any departmental AI vendor or internal ticket.
3. **Lens C: Geo-Payload Engineer *(Targeted at Junior Developers & Technical Peers)***
   * **Focus:** Constructing the `@google/genai` TypeScript request, combining `googleMaps` and `googleSearch` tools, anchoring `retrievalConfig.latLng`, and parsing `groundingChunks` for UI attribution.
   * **Immediate Takeaway:** Copy-pasteable TypeScript service code for multi-tool grounding.

---

## 6. Pilot Module Specification: "The HKU AI Lunch Rotator (Gacha)"

### Module Overview
* **Problem Statement:** Deciding where to eat lunch around HKU (Canteen vs. Sai Ying Pun vs. Kennedy Town) wastes 15 minutes daily. Naive AI wrappers fail because they hallucinate closed shops and repeat the same answer ("mode collapse").
* **Architectural Solution:** Use Gemini (`gemini-2.5-flash`) with dual grounding (`googleMaps` + `googleSearch`) to curate a verified pool of 5 restaurants matching team filters, then use a deterministic client-side spinning wheel for true randomness.

### Dual-Grounding Service Implementation (`server/src/services/geminiGrounding.ts`)
```typescript
import { GoogleGenAI } from '@google/genai';

export interface LunchQueryConfig {
  campusOrigin: 'MAIN_BUILDING' | 'CENTENNIAL' | 'SASSCON_RD';
  maxBudgetHKD: number;
  maxWalkMins: number;
  weatherRoute: 'ANY' | 'RAIN_SHELTERED' | 'NO_STEEP_SLOPES';
  vibeInstruction: string;
}

const HKU_COORDINATES = {
  MAIN_BUILDING: { latitude: 22.2830, longitude: 114.1371 },
  CENTENNIAL: { latitude: 22.2840, longitude: 114.1325 },
  SASSCON_RD: { latitude: 22.2675, longitude: 114.1311 },
};

export async function fetchGroundedLunchPool(apiKey: string, query: LunchQueryConfig) {
  const ai = new GoogleGenAI({ apiKey });
  const coords = HKU_COORDINATES[query.campusOrigin];

  const prompt = `
    Find 5 distinct, currently operating restaurants near HKU (${query.campusOrigin}) matching:
    - Budget: Under HK$${query.maxBudgetHKD}
    - Max walk: ${query.maxWalkMins} minutes
    - Route constraint: ${query.weatherRoute}
    - Team Mood & Pitch Style: "${query.vibeInstruction}"

    Grounding Instructions:
    1. Use Google Maps to verify real operating status, rating, and proximity to the provided coordinates.
    2. Use Google Search to cross-check local Hong Kong food reviews, signature lunch dishes, and price range.

    Return ONLY a valid JSON array of 5 objects with keys:
    "name", "cuisine", "priceHKD", "walkMins", "signatureDish", "pitch"
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      tools: [
        { googleMaps: {} },
        { googleSearch: {} }
      ],
      toolConfig: {
        retrievalConfig: {
          latLng: coords,
          languageCode: 'en_HK',
        },
      },
      temperature: 0.5,
    },
  });

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

  return {
    rawJsonText: response.text,
    searchQueries: response.candidates?.[0]?.groundingMetadata?.webSearchQueries || [],
    mapSources: chunks.filter((c: any) => c.maps).map((c: any) => ({
      title: c.maps.title,
      uri: c.maps.uri,
    })),
    webSources: chunks.filter((c: any) => c.web).map((c: any) => ({
      title: c.web.title,
      uri: c.web.uri,
    })),
  };
}
```

### 18-Minute Lightning Run-of-Show (Saved in `template-15min-lunch-gacha.json`)
1. **Block 1 (`00:00 - 03:00`) | `POLL` — The HKU Lunch Bottleneck:**
   * *Activity:* QR join $\rightarrow$ Live Menti poll on what kills lunch decisions at HKU.
   * *Concept:* Why "vibe coding" any viral app on the internet comes down to 3 layers (UX Prompt, Grounding Strategy, API Payload).
2. **Block 2 (`03:00 - 06:00`) | `QUIZ` — Why Naive AI Wrappers Fail:**
   * *Q1:* Why does asking an LLM for a "random restaurant" return the same noodle shop 4 times? *(Mode collapse vs. deterministic wheel).*
   * *Q2:* Why combine `googleMaps` AND `googleSearch` in the payload? *(Geospatial distance/hours vs. local HK menu/OpenRice buzz).*
3. **Block 3 (`06:00 - 14:00`) | `LAB_3_LENS` — Co-Architecting the Team Rotator:**
   * Participants select their Lens on their device and discuss in 3-person triads:
     * **Lens A:** Crafts the mood preset (e.g., *"Post-deployment comfort carbs"*) and re-spin UX rule.
     * **Lens B:** Selects the top 3 HKU filters (budget slider, escalator/slope filter, seat turnover) and maps each to Maps vs. Search grounding.
     * **Lens C:** Fills in the 3 missing keys in the `@google/genai` payload (`tools`, `retrievalConfig.latLng`, and `groundingChunks` extraction).
4. **Block 4 (`14:00 - 17:00`) | `SANDBOX_SPIN` — Live Wheel Spin & Grounding Audit:**
   * Presenter selects a triad's combined submission on screen $\rightarrow$ clicks **Fetch & Spin**.
   * The wheel spins across 5 grounded restaurants, lands on a winner, and displays clickable **Google Maps Pins** and **Google Search citations**.
   * All results are automatically appended to the session's `.json` archive.
5. **Block 5 (`17:00 - 18:00`) | `HOMEWORK` — Immediate Export & Coffee Challenge:**
   * One-click download of the **1-Page AI App Deconstruction Cheat Sheet**.
   * **Optional Homework:** Revisit this session anytime via the **Session Dropdown**, plug in a free AI Studio BYOK key, and add a custom filter or clone another app concept (e.g., *Happy Hour Rotator*, *Hiking Trail Gacha*) for a 1-on-1 coffee chat review.

---

## 7. Phased Implementation Plan (~10 Hours Total Effort)

### Phase 1: Proactive Data Gathering & JSON Schema Setup (2 Hours)
* [ ] Initialize monorepo (`client` + `server`) with TypeScript interfaces for `TrainingSessionJSON`.
* [ ] Build `server/src/scripts/proactiveGather.ts` using your Gemini API key to pre-fetch and save 5 common HKU lunch filter presets (including real `mapSources` and `webSources`) into `hku-restaurants-fallback.json`.
* [ ] Author the initial `template-15min-lunch-gacha.json` file containing the 5 lesson blocks.

### Phase 2: Backend State Recorder & WebSocket Engine (2.5 Hours)
* [ ] Implement `sessionRecorder.ts` to list all `.json` files in `/server/data/sessions/` and flush live state updates to disk automatically.
* [ ] Set up `Socket.io` events (`join_session`, `advance_block`, `submit_poll`, `submit_quiz`, `submit_lab`).
* [ ] Expose `POST /api/rotator/spin` supporting both live BYOK headers (`x-gemini-api-key`) and instant fallback to pre-cached HKU data if no key is provided or if campus Wi-Fi lags.

### Phase 3: Frontend Shell, Session Dropdown & Interactive Blocks (4 Hours)
* [ ] Build the top bar with `<SessionDropdown />` (allowing instant toggling between the Live WebSocket session and archived `.json` sessions in Replay Mode) and `<ByokKeyDrawer />`.
* [ ] Build `<PollBlock />` (animated Tailwind horizontal progress bars) and `<QuizBlock />` (countdown timer + top-5 leaderboard).
* [ ] Build `<ThreeLensLabBlock />` with role tabs (Experience Designer / Grounding Strategist / Payload Engineer) so every colleague sees a clean, tailored interactive task.
* [ ] Build `<LunchRotatorWheel />` using CSS `conic-gradient` + smooth cubic-bezier rotation, paired with a Grounding Verification drawer showing Maps links and Search queries.

### Phase 4: Rehearsal, Snapshot Testing & Polish (1.5 Hours)
* [ ] Simulate a full 18-minute session with 3 mobile browser tabs (testing Lens A, B, and C simultaneously) and verify that the completed session saves cleanly to `/server/data/sessions/2026-XX-XX-rehearsal.json`.
* [ ] Test selecting the saved rehearsal from the `<SessionDropdown />` to verify that all polls, quiz scores, and wheel spins replay seamlessly without a login.
```