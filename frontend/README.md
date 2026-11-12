# Backhand Swipe frontend

React + Vite + TypeScript, styled with Tailwind CSS.

```bash
bun install
bun run dev      # http://localhost:5173
bun run build
bun run lint
```

## Data

The app calls `/api/...`, which the Vite dev server proxies to the backend Worker on `http://localhost:8787`. Start the backend first; see the [root README](../README.md).

The REST contract is documented at the bottom of `src/api/types.ts`. The backend imports these types too, so both sides stay in sync.

Fighter images live in `public/fighters/`.

## Layout

- `src/pages/` has one component per screen: vote, rankings, and where do I rank.
- `src/components/` holds shared pieces such as the swipe card, the header, and the vote split bar.
- `src/index.css` defines the palettes. Each palette sets CSS variables (`--bg`, `--panel`, `--corner-l`, `--corner-r`, and so on) that Tailwind exposes as `bg-panel`, `text-corner-l`, etc. The menu-style pieces (`stripes`, `outlined`, `cut`, `segment`, `press`) live there too. The palette and the metric or imperial units are chosen from the settings menu in the header and saved to localStorage.
