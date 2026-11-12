# Backhand Swipe backend

A Cloudflare Worker that serves the API and the built frontend, with hand-written SQL against [Turso](https://turso.tech) (hosted SQLite). Locally it uses a plain SQLite file, `local.db`; open it with `sqlite3 local.db`.

## Code

- `db/schema.sql` creates the tables: `fighter`, `matchup`, `vote`, and `fighter_rating_snapshot`.
- `src/api.ts` has the queries behind each endpoint.
- `src/app.ts` routes `/api` requests. `src/worker.ts` runs it on Cloudflare, and `scripts/dev.ts` runs it locally under Bun.
- `scripts/db.ts` creates the tables and imports fighters from a CSV.
- `wrangler.jsonc` is the Cloudflare configuration.

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

`bun run images photo.png cat` shrinks the image to a small WebP at `frontend/public/fighters/cat.webp`. Transparent backgrounds look best. Several fighters can share one image, like "5 house cats" and "20 house cats".

## Deploying

One-time setup:

1. Create a Turso database and get its URL and a token:

2. Put both in `backend/.env.production`:

   ```
   TURSO_DATABASE_URL="libsql://backhand-swipe-<you>.turso.io"
   TURSO_AUTH_TOKEN="..."
   ```

3. Give the Worker the same two values, read straight from that file:

   ```bash
   bunx wrangler login
   bunx wrangler secret bulk .env.production
   ```

   Run `secret bulk` again whenever either value changes. It takes effect immediately, no redeploy needed.

Then:

- **Load fighters** into the live database: `bun --env-file=.env.production run db:import fighters.csv`. No redeploy needed.
- **Deploy** code or image changes: `bun run deploy`. The site is at `https://backhand-swipe.<your-subdomain>.workers.dev`.
- **Read logs**: `bunx wrangler tail`, or the Cloudflare dashboard.

## Testing in the Worker runtime

`bun run dev` runs the API under Bun, because the Worker runtime can't open a local file. To run it in the real Worker runtime instead, put a Turso URL and token in `.dev.vars` and run `bun run dev:worker`.
