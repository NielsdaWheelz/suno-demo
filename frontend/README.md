# frontend (react + vite + tailwind)

frontend-only readme. backend docs are handled elsewhere.

## what this is
- single-page “suno-like” ui that lets a user enter a brief, set a few control params, generate 3 clips at a time, and explore **node-based branching** (“more like this” from any node) with lineage lines.
- entirely in-memory per page load; no routing, auth, or persistence.
- uses a single bottom `<audio>` element (centralized player) with a lightweight audio visualizer; Track tiles no longer embed their own `<audio>`.

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
- `src/App.tsx`: owns session + control state, wires api mutations, and renders the three-slot shell (`Sidebar`, `MainPanel`, `BottomPlayer`) inside `PlayerProvider`.
- `components/`
  - `ShellLayout`: grid shell (sidebar, main, bottom bar).
  - `Sidebar`: static nav placeholder.
  - `MainPanel`: two-column layout (controls left, generations right).
  - `ControlPanel`: brief textarea; sliders for energy/density/duration_sec/tempo_bpm/brightness; “instrumental only” checkbox; generate button; no `num_clips` input (UI is fixed to 3 clips per generation).
  - `NodeGrid`: groups nodes by generationIndex, draws lineage lines, renders `NodeCard` rows; handles empty/loading placeholders.
  - `NodeCard`: label + parent hint, play + “more like this” buttons (disabled on global loading).
  - `TrackTile`: trimmed-down play button that uses `PlayerContext` (no inline `<audio>`).
  - `BottomPlayer`: single `<audio>` for the selected track + canvas visualizer; auto-plays selection; shows label + short id.

## data flow (happy path)
1) generate: `ControlPanel` submit → `App` calls `createSession` → maps returned tracks to `NodeView` with `generationIndex=0` → `NodeGrid` renders them. loading/error states live in `App` and flow down.
2) more-like: user clicks “more like this” on a node → `App` calls `moreLikeCluster` with fixed `num_clips=3` and the node’s `backendClusterId` → response cluster is flattened to new nodes with `generationIndex=nextGenerationIndex` and `parentNodeId` set to the clicked node → appended and selected.
3) playback: any play button calls `playTrack` from `PlayerContext`; `BottomPlayer` auto-plays and shows the selection with visualizer.

## styling
- tailwind classes only; dark theme base (`bg-slate-950`, `text-slate-100`).
- layout grid: sidebar fixed ~220px, bottom player fixed height, main scrolls; node grid uses 1/3 columns with SVG overlay for lines.

## tests
- key flows are covered in `src/components/__tests__` and `src/App*.test.tsx`. run `npm run test`. jsdom is configured in `src/test/setup.ts`.

## troubleshooting
- seeing “Request failed (XXX)”: check `VITE_API_BASE` and that the backend endpoints are reachable.
- blank audio: confirm `audio_url` resolves; audio errors rely on native `<audio>` messaging.
