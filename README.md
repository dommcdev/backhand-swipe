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
- `db/schema.sql` creates the tables: `fighter`, `pair`, `vote`, `fighter_rating_snapshot`, and `closest_call`.
- `scripts/db.ts` creates the tables and imports fighters from a CSV. `scripts/images.ts` makes fighter images.
- `public/fighters/` holds the fighter images.
- `wrangler.jsonc` is the Cloudflare configuration. After changing it, run `bun run types` to update `worker-configuration.d.ts`.

### Keeping database reads small

D1 bills per row read, and the free tier allows 5 million a day. The rule: **every request reads a small, fixed number of rows through an index**, however many fighters and votes there are. `bunx wrangler d1 insights backhand-swipe --sort-by reads` shows which queries read the most.

- **Totals live on the rows they describe.** A fighter has its `wins` and `losses`. `pair` has the head-to-head between two fighters, created the first time they meet, so there's no table of every possible pair. A vote updates the two fighters and their pair in one transaction. Nothing counts `vote` per request.
- **Rankings load 50 at a time** through the `elo` indexes. Search is the exception: a name can match anywhere, so it reads every fighter in scope.
- **"Where do I rank?"** needs the whole roster, so `/api/roster` is cached by Cloudflare for 5 minutes.
- **Cron jobs do anything that needs to look at everything.** Hourly, if anyone voted: pick the closest calls into `closest_call`. Nightly: refit the ratings, then snapshot everyone's place into `fighter_rating_snapshot` for the "This week" column. Snapshots older than about a week are deleted.

Rough cost per request: a vote reads about 5 rows, a batch of matchups about 100, and a rankings page about 150.

### Local load test and row accounting

`bun run dev` adds `X-D1-Rows-Read`, `X-D1-Rows-Written`, and `X-D1-Queries` to API responses,
using D1's result metadata (including index writes). These headers and the measurement wrapper
are disabled in production builds. The query counter counts SQL statements, not D1 binding calls.

With the dev server running, `bun run load-test` simulates 100 concurrent users voting without
pauses for 600 seconds. Each user fetches five real matchups, votes on each with a random winner,
and repeats. It reports requests, errors, rows, and latency percentiles per endpoint. It refuses
non-local URLs. **It adds real test votes to your local database**; back up your local D1 first
if you want to preserve its rankings. It does not touch production.

Optional environment variables: `LOAD_USERS`, `LOAD_SECONDS`, `LOAD_THINK_MS` (pause after each
vote), `LOAD_URL` (default `http://127.0.0.1:5173`), and `LOAD_OUTPUT` (default
`/tmp/opencode/backhand-load`). Progress is printed every 30 seconds and saved to `progress.json`;
the final report is `results.json`. Requests already in flight can finish after the deadline.

This is an API/database test, not a browser or production throughput benchmark: it excludes
rendering, images, rankings browsing, cron work, and real edge CPU/network/durable-write latency.
Local D1 does not enforce your account's daily quotas. Compare the reported rows with the
[current D1 quotas](https://developers.cloudflare.com/d1/platform/pricing/) and requests with
the [Workers quotas](https://developers.cloudflare.com/workers/platform/limits/), allowing for
other account usage that day. A local passing run does not prove the free plan will pass.

### Ratings

`worker/ratings.ts` gets the most out of each vote:

- **Matchmaking** builds most matchups around fighters with the fewest votes, against an opponent rated near them (found through the `elo` index). Some opponents are fully random, so every pair can come up.
- **Live updates** on each vote move fighters with few votes further (K from 64 down toward 16), so they find their level quickly.
- **Nightly refit** recomputes every rating from all head-to-head totals at once (a Bradley-Terry fit), pulled lightly toward each fighter's starting rating (`start_elo`, from the CSV). Vote order stops mattering, and early votes get re-weighed against everything since.

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

`bun run db:import fighters.csv` checks every row first and imports nothing if anything is wrong. Otherwise it adds new fighters and updates existing ones (keeping their elo). Fighters missing from the CSV are kept; add `--prune` to delete them with their votes.

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
- **Deploy** code or image changes: `bun run deploy`. The site is at `https://backhandswipe.com` (complete the domain setup below first). The default `workers.dev` URL is disabled.
- **Read logs**: `bunx wrangler tail`, or the Cloudflare dashboard.

### Domain setup

`backhandswipe.com` was purchased through Cloudflare Registrar, so its nameservers and Cloudflare DNS zone are already set up. No registrar changes or manual DNS records are needed.

1. Confirm the domain is **Active** in the same Cloudflare account as the Worker.
2. Run `bun run deploy`. The custom domain in `wrangler.jsonc` tells Cloudflare to create the DNS record and HTTPS certificate automatically.
3. Verify `https://backhandswipe.com` once the certificate is ready.

Only the root domain is configured; `www.backhandswipe.com` is not included.
