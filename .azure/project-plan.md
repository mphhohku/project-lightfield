# Approved Project Plan: Lightfield

## Goal
Build the full HKU AI fieldwork and knowledge-exchange platform described in the repository's `project-plan.md`, with the HKU Lunch Rotator as its pilot. The app must be runnable locally and support presenter-led live sessions, participant activities, JSON session replay, BYOK-grounded lunch recommendations, and an optional interactive field-testing map.

## Stack and Architecture
- Frontend: Vue 3 Composition API, TypeScript, Vite, Tailwind CSS, Pinia, and Socket.IO client.
- Backend: Node.js and TypeScript with HTTP APIs and Socket.IO. Keep active session state in memory and persist session snapshots as JSON files under `server/data/sessions/`; no database or user accounts.
- Include starter curriculum/session JSON and a deterministic fallback restaurant dataset so the app can be explored without a key or live API access.
- Do not deploy or add cloud resources.

## Required Features
1. **Session shell:** LIGHTFIELD header, zero-login participant join with generated UUID and HKU-themed alias, presenter controls, and a session dropdown for active and archived sessions.
2. **Live/replay:** Presenter can advance through configurable `POLL`, `QUIZ`, `CONCEPT`, `LAB_3_LENS`, `SANDBOX_SPIN`, and `HOMEWORK` blocks. Participants receive live updates and submit activities over Socket.IO. Recorded sessions replay locally without modifying the archive.
3. **Activities:** Functional polls with aggregate results, timed quizzes with scores/leaderboards, and a three-role lab (Experience, Grounding, Payload) that records submissions.
4. **HKU Lunch Rotator:** Collect campus origin, HKD budget, maximum walking time, weather/route constraint, and team vibe. Ground five distinct restaurant results, display sources, and select a winner with a deterministic client-side wheel. Save generated session artifacts and grounding citations in JSON archives.
5. **BYOK:** User-provided API key. Make an HTTP `fetch` request to `https://apidev.hku.hk/vertexai-gemini/gemini-3.8-flash:generateContent`; do not require the Google SDK. Send the user's request structure: `system_instruction.parts[].text`, `contents` with a user text part, `generationConfig.thinkingConfig.thinkingLevel: "medium"`, and `tools: [{google_search: {}}, {googleMaps: {}}]`. Parse generated text and grounding metadata for Google Maps/Search citations. Keep the key in browser memory only; never log it or write it to session JSON, local storage, or server files. Provide useful loading, error, and no-key/fallback states.
6. **Optional Field Testing map:** Add a toggleable Leaflet + OpenStreetMap map (no additional map key) for grounded results. Show verified restaurant coordinates when supplied by grounding, with selectable markers/popups connected to the result list and winner. Do not invent coordinates; gracefully hide markers/map details when trustworthy coordinates are unavailable.
7. **Archives:** Store session metadata, curriculum blocks, polls, quiz results, lens submissions, and generated restaurant artifacts/citations as validated JSON. Provide safe server-side listing/loading and write operations.
8. **Practical learning and scaffolding:** Begin every curriculum with 2–3 actionable learning objectives and revisit them in the takeaway. Provide optional guided steps, a hint, and a stretch challenge for each activity without labeling participant ability.
9. **Anonymous participation:** Include anonymous Stars and Wishes takeaway feedback plus a live Q&A panel with participant upvotes and presenter answered controls. Do not persist feedback submitter IDs, question authors, or voter IDs.
10. **Theme choice:** Offer a persistent light/dark appearance toggle; only the non-sensitive preference may be stored in browser local storage.

## Quality and Acceptance Criteria
- Keep modules typed and validate HTTP/socket payloads at runtime.
- Never persist or expose the BYOK key in errors, logs, socket events, or saved JSON.
- Provide responsive participant and presenter views, accessible controls, and empty/loading/error states.
- Include focused tests for request serialization/response parsing, key redaction, session recording/replay, activity state updates, anonymous feedback/Q&A, learning objectives, and map marker handling.
- The app must build and its configured tests/type checks must pass. Document local setup, learning design, anonymous participation, theme choice, and the optional map/BYOK flow in the README.
