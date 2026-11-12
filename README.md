# Backhand Swipe

Who would win?

- `frontend/`: React + Vite app. See [frontend/README.md](frontend/README.md).
- `backend/`: a Cloudflare Worker with hand-written SQL against [Turso](https://turso.tech) (hosted SQLite). In production the same Worker serves the built frontend.

## Run it locally

You need [Bun](https://bun.sh).

```bash
cd backend
bun install
cp .env.example .env                        # points at backend/local.db
bun run db:import db/fighters.example.csv   # creates local.db and loads some fighters
bun run dev                                 # API on http://localhost:8787

cd frontend && bun install && bun run dev   # App on http://localhost:5173, proxies /api to the backend
```

The local database is the plain SQLite file `backend/local.db`, so `sqlite3 backend/local.db` opens it. To wipe everything and start over, run `bun run db:reset` in `backend/`, or delete the file.

`bun run dev` runs the API handlers under Bun, because the Worker runtime can only reach Turso over HTTP and can't open a local file. To run the real Worker runtime locally, put a Turso database's URL and token in `backend/.dev.vars` and run `bun run dev:worker`.

## Database

- `backend/db/schema.sql` creates the tables: `fighter`, `matchup`, `vote`, and `fighter_rating_snapshot`.
- `backend/scripts/db.ts` loads fighters from a CSV and creates the matchups.
- `backend/src/api.ts` has the queries behind each endpoint, including the vote that updates elo.
- `backend/src/app.ts` routes `/api` requests to them. `src/worker.ts` wraps it for Cloudflare, and `scripts/dev.ts` wraps it for local development.

Wins, losses, and head-to-head votes aren't stored. They are counted from `vote` when the rankings are requested. A fighter's elo is stored because it depends on the order of every vote before it.

Once a day at midnight UTC, a cron trigger saves everyone's elo to `fighter_rating_snapshot`. The "This week" column compares today's ranks with the oldest snapshot from the last 7 days.

## Adding fighters

Fighters come from a CSV file, for example one exported from a shared Google Sheet. The header row must be exactly:

```
fighter_id,name,short_name,category,quantity,emoji,image_url,weight_kg,height_cm,age,secret_weapon,weakness,elo
```

| Column | Required | Notes |
| --- | --- | --- |
| `fighter_id` | yes | Lowercase letters, digits, and dashes, like `tyson` or `gorilla-5`. Don't change it after people have voted. |
| `name` | yes | Shown on the card, with the headcount: `5 gorillas` |
| `short_name` | yes | Used mid-sentence: `the gorillas` |
| `category` | yes | `people`, `fictional`, `animals`, or `objects` |
| `quantity` | no | How many fight together. Defaults to 1. |
| `emoji` | no | Shown when there's no image. Initials are shown when this is empty too. |
| `image_url` | no | A file in `frontend/public`, like `/fighters/gorilla.webp` |
| `weight_kg` | yes | Weight of one of them |
| `height_cm`, `age` | no | Only for real people. They power the "Where do I rank?" page. |
| `secret_weapon`, `weakness` | yes | Shown on the card |
| `elo` | no | Starting rating. Defaults to 1000. Only used the first time a fighter is imported. |

`backend/db/fighters.example.csv` has a few rows to copy.

```bash
cd backend
bun run db:import path/to/fighters.csv
```

The import checks every row first and imports nothing if any row has a problem, listing each problem by line. Otherwise it adds new fighters, updates existing ones while keeping their current elo, and creates a matchup between every pair of fighters. Fighters in the database that aren't in the CSV are left alone and listed; add `--prune` to delete them along with their matchups and votes.

## Adding images

Fighters show `image_url` when it is set, otherwise their emoji, otherwise their initials.

```bash
cd backend
bun run images ~/Downloads/house-cat.png cat   # writes frontend/public/fighters/cat.webp
```

The script trims empty borders and shrinks the image to fit 384×384 as WebP, which usually comes out at 10–40 KB. Images with a transparent background look best on the cards. Then put `/fighters/cat.webp` in the fighter's `image_url` column and import the CSV again. Groups like "5 house cats" and "20 house cats" can share an image; the card draws it once per fighter, up to a crowd.

The app downloads the art for upcoming matchups while you vote on the current one, so cards show up with their images already loaded.

## Deploying

One-time setup:

1. Create a Turso database, ideally in a region near your users, and get its URL and a token:

   ```bash
   turso db create backhand-swipe
   turso db show backhand-swipe --url
   turso db tokens create backhand-swipe
   ```

2. Put both values in `backend/.env.production` (ignored by git):

   ```
   TURSO_DATABASE_URL="libsql://backhand-swipe-<you>.turso.io"
   TURSO_AUTH_TOKEN="..."
   ```

3. Load the fighters into it:

   ```bash
   cd backend
   bun --env-file=.env.production run db:import path/to/fighters.csv
   ```

4. Give the Worker the same two values. Each command prompts for the value:

   ```bash
   bunx wrangler secret put TURSO_DATABASE_URL
   bunx wrangler secret put TURSO_AUTH_TOKEN
   ```

To deploy, run `bun run deploy` in `backend/`. It builds the frontend and uploads it with the Worker to `https://backhand-swipe.<your-subdomain>.workers.dev`. Wrangler asks you to log in the first time.

To change fighters after that, run the `bun --env-file=.env.production run db:import ...` command again. No redeploy is needed. New images do need a redeploy, since they ship with the frontend.

Logs for the deployed Worker are in the Cloudflare dashboard under Workers & Pages, backhand-swipe, Observability. To stream them live, run `bunx wrangler tail`.
