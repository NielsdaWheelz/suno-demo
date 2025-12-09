# frontend (react + vite + tailwind)

frontend-only readme. backend docs are handled elsewhere.

## what this is
- single-page “suno-like” ui that lets a user enter a brief, set a few numeric params, request a batch of clips, view clusters/tracks, and request “more like this” from a cluster.
- entirely in-memory per page load; no routing, auth, or persistence.
- uses native `<audio>` for playback; bottom bar is a simple now-playing area.

## stack
- react 19 + typescript, vite, tailwindcss.
- @tanstack/react-query used only for mutations (no cached queries).
- testing via vitest + @testing-library/react.

## local setup
```bash
cd frontend
npm install
```

## running it
- `npm run dev` — start vite dev server.
- `npm run build` — type-check (`tsc -b`) then bundle.
- `npm run preview` — preview built assets.
- `npm run lint` — eslint.
- `npm run test` — vitest unit/component tests.

## env
- `VITE_API_BASE` (required): base url for the backend api (e.g., `http://localhost:8000`). requests hit `/sessions` and `/sessions/{session_id}/clusters/{cluster_id}/more`.

## layout & components
- `src/main.tsx`: bootstraps react-query provider, renders `App`.
- `src/App.tsx`: owns session + control state, wires api mutations, and renders the three-slot shell (`Sidebar`, `MainPanel`, `BottomPlayer`).
- `components/`
  - `ShellLayout`: grid shell (sidebar, main, bottom bar).
  - `Sidebar`: static nav placeholder.
  - `MainPanel`: wraps control panel + cluster area; shows session status/error banner.
  - `ControlPanel`: brief textarea, clamped num_clips input (1–6), energy/density/duration sliders, generate button; disables during mutations.
  - `ClusterGrid`: renders cluster cards; handles empty/loading placeholder text.
  - `ClusterCard`: label + source tag, per-card “more like this” button (disabled when loading), list of `TrackTile`.
  - `TrackTile`: shows track id/duration, inline `<audio controls>`, “send to player”.
  - `BottomPlayer`: single `<audio>` for the selected track; shows cluster label + short id.

## data flow (happy path)
1) generate: `ControlPanel` submit → `App` calls `createSession` → maps returned clusters to `ClusterView` with `source="initial"` → `ClusterGrid` renders them. loading/error states live in `App` and flow down.
2) more-like: user clicks on a cluster → `App` calls `moreLikeCluster` with current `num_clips` → expects exactly one cluster in response → appended with `source="more"` + `parentClusterId`. button/controls disable while loading that cluster.
3) track selection: `TrackTile` → `App` sets `currentTrack` → `BottomPlayer` shows it; playback is manual.

## styling
- tailwind classes only; dark theme base (`bg-slate-950`, `text-slate-100`).
- layout grid: sidebar fixed ~220px, bottom player fixed height, main scrolls; cluster grid responsive (1/2/3 cols based on breakpoints).

## tests
- key flows are covered in `src/components/__tests__` and `src/App*.test.tsx`. run `npm run test`. jsdom is configured in `src/test/setup.ts`.

## troubleshooting
- seeing “Request failed (XXX)”: check `VITE_API_BASE` and that the backend endpoints are reachable.
- blank audio: confirm `audio_url` resolves; audio errors rely on native `<audio>` messaging.
