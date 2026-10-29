# Lightfield

Lightfield is a zero-login fieldwork platform for presenter-led workshops, participant activities, and replayable JSON Field Logs. The HKU Lunch Rotator is the pilot module; it can use demo data without a key or send a BYOK request directly from the browser to the HKU Gemini endpoint.

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. The Vite frontend proxies `/api` and Socket.IO traffic to the local server on port 3000. The first page lets a presenter start a session or open the included archived example. Participants can join a live session using its shared link; no account is required.

Useful checks:

```bash
npm test
npm run typecheck
npm run build
npm run check
```

## Learning, feedback, and Q&A

Each curriculum opens with 2–3 practical learning objectives and revisits them in the closing takeaway, where participants choose an objective and write an action they can try at work. Activities include optional guided steps, a hint, and a stretch challenge so participants can choose the support or depth they need.

The closing block includes anonymous **Stars and Wishes** feedback. An always-available live Q&A panel accepts anonymous questions, lets participants upvote once, and lets the presenter mark questions answered. Saved feedback and questions omit participant IDs and aliases. A header control switches between dark and light themes; the preference is stored locally in the browser.

## Field Tests and BYOK

In the `SANDBOX_SPIN` / Field Testing block, use **Explore demo data** to try the rotator without credentials. Demo suggestions are fictional and are not current business recommendations.

For live grounding, paste a Gemini API key into **Bring your own API key**, set the campus, budget, walking time, route constraint, and vibe, then choose **Find with live grounding**. The browser sends a plain `fetch` request to:

`https://apidev.hku.hk/vertexai-gemini/gemini-3.8-flash:generateContent`

The key is kept in page memory, sent only to that endpoint, and never sent to the Lightfield server or saved in a Field Log. Reloading or closing the page clears it. Live API access and browser CORS must be enabled for the supplied endpoint/key. If the endpoint returns no grounding citations, Lightfield labels the response as unverified; verify restaurant details independently.

The optional **Field map** toggle uses Leaflet and OpenStreetMap. It displays only coordinates returned alongside a matching Maps grounding result; no locations are estimated. The included demo data has no coordinates, so the map shows an explanatory empty state until usable coordinates are returned.

## Local data

Curriculum and demo data live under `server/data/templates/` and `server/data/cache/`. Live session snapshots are written as JSON under `server/data/sessions/`. This is local filesystem storage, not a shared or production database. Do not expose this development server to untrusted networks.
