# Backhand Swipe frontend

React + Vite + TypeScript, styled with Tailwind CSS.

```bash
bun install
bun run dev      # http://localhost:5173
bun run build
bun run lint
```

## Data

By default the app runs against an in-browser mock (`src/api/mock.ts`) with seed fighters in `src/api/mockData.ts`. Votes update Elo ratings in memory until the page reloads.

To call the Java backend instead, create `.env.local` with `VITE_API_MODE=live`. Requests go to `/api/...`, which the Vite dev server proxies to `http://localhost:8080`.

The REST contract the backend needs to implement is documented at the bottom of `src/api/types.ts`.

## Layout

- `src/pages/` has one component per screen: vote, rankings, and where do I rank.
- `src/components/` holds shared pieces such as the swipe card, the header, and the vote split bar.
- `src/index.css` defines the palettes. Each palette sets CSS variables (`--bg`, `--panel`, `--corner-l`, `--corner-r`, and so on) that Tailwind exposes as `bg-panel`, `text-corner-l`, etc. The menu-style pieces (`stripes`, `outlined`, `cut`, `segment`, `press`) live there too. The palette and the metric or imperial units are chosen from the settings menu in the header and saved to localStorage.
