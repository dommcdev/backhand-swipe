# Backhand Swipe

Who would win? Swipe to vote, then see the rankings.

One Cloudflare Worker serves the React app and the `/api` routes, with hand-written SQL against [D1](https://developers.cloudflare.com/d1/) (Cloudflare's SQLite).

## Run it locally

You need [Bun](https://bun.sh).

```bash
bun install
bun run db:import db/fighters.example.csv
bun run dev
```

Open http://localhost:5173. Vite runs the Worker in the real Workers runtime with a local D1 database stored in `.wrangler/state`. There are no env files or secrets.

## Common tasks

Add `--remote` to any `db:` command to run it on the deployed database instead of the local one.

| Task | Command |
| --- | --- |
| Add or update fighters | `bun run db:import fighters.csv` (see [the CSV format](#fighters-csv)) |
| Add a fighter image | `bun run images photo.png cat`, then set `image_url` to `/fighters/cat.webp` in the CSV |
| Start the database over | `bun run db:reset` (with `--remote`, also needs `--yes`) |
| Deploy | `bun run deploy` (first time: see [Deploying](#deploying)) |
| Lint | `bun run lint` |

## Code

- `src/` is the React app (Vite, TypeScript, Tailwind).
  - `src/pages/` has one component per screen: vote, rankings, and where do I rank.
  - `src/components/` holds shared pieces such as the swipe card, the header, and the vote split bar.
  - `src/api/types.ts` has the types and the REST contract. The Worker imports them too, so both sides stay in sync.
  - `src/index.css` defines the palettes. Each palette sets CSS variables (`--bg`, `--panel`, `--corner-l`, `--corner-r`, and so on) that Tailwind exposes as `bg-panel`, `text-corner-l`, etc. The menu-style pieces (`stripes`, `outlined`, `cut`, `segment`, `press`) live there too. The palette and units are chosen from the settings menu and saved to localStorage.
- `worker/` is the API. `app.ts` routes `/api` requests and `api.ts` has the queries behind each endpoint.
- `db/schema.sql` creates the tables: `fighter`, `matchup`, `vote`, and `fighter_rating_snapshot`.
- `scripts/db.ts` creates the tables and imports fighters from a CSV. `scripts/images.ts` makes fighter images.
- `public/fighters/` holds the fighter images.
- `wrangler.jsonc` is the Cloudflare configuration. After changing it, run `bun run types` to update `worker-configuration.d.ts`.

Wins, losses, and head-to-head votes are counted from `vote` when needed rather than stored. A fighter's elo is stored, because it depends on the order of every vote before it. Once a day a cron trigger copies everyone's elo into `fighter_rating_snapshot`, which the "This week" column compares against.

## Fighters CSV

`db/fighters.example.csv` shows the format. The header row must be:

```
fighter_id,name,short_name,category,quantity,emoji,image_url,weight_kg,height_cm,age,secret_weapon,weakness,elo
```

| Column | Required | Notes |
| --- | --- | --- |
| `fighter_id` | yes | Lowercase letters, digits, and dashes, like `gorilla-5`. Don't change it once people have voted. |
| `name` | yes | Shown on the card: `5 gorillas` |
| `short_name` | yes | Used mid-sentence: `the gorillas` |
| `category` | yes | `people`, `fictional`, `animals`, or `objects` |
| `quantity` | no | How many fight together. Defaults to 1. |
| `emoji` | no | Shown when there's no image |
| `image_url` | no | Like `/fighters/gorilla.webp` |
| `weight_kg` | yes | Weight of one of them |
| `height_cm`, `age` | no | Only for real people, for the "Where do I rank?" page |
| `secret_weapon`, `weakness` | yes | Shown on the card |
| `elo` | no | Starting rating, used only when the fighter is first added. Defaults to 1000. |

`bun run db:import fighters.csv` checks every row first and imports nothing if anything is wrong. Otherwise it adds new fighters, updates existing ones (keeping their elo), and creates a matchup for every pair. Fighters missing from the CSV are kept; add `--prune` to delete them with their votes.

## Images

`bun run images photo.png cat` shrinks the image to a small WebP at `public/fighters/cat.webp`. Transparent backgrounds look best. Several fighters can share one image, like "5 house cats" and "20 house cats". Images are served as static assets, which Cloudflare doesn't charge for.

Images aren't tracked in git. `bun run deploy` uploads whatever is in `public/fighters/`, and each deploy replaces the last, so only deploy from a machine that has every image. Otherwise the missing ones disappear from the live site.

## Deploying

One-time setup:

```bash
bunx wrangler login
bunx wrangler d1 create backhand-swipe --binding DB --update-config
bun run db:migrate --remote
```

The second command adds the database's id to `wrangler.jsonc`; commit that change.

Then:

- **Load fighters** into the live database: `bun run db:import fighters.csv --remote`. No redeploy needed.
- **Deploy** code or image changes: `bun run deploy`. The site is at `https://backhand-swipe.<your-subdomain>.workers.dev`.
- **Read logs**: `bunx wrangler tail`, or the Cloudflare dashboard.
