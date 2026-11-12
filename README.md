# Backhand Swipe

Who would win? Swipe to vote, then see the rankings.

- `frontend/`: the React app. See [frontend/README.md](frontend/README.md).
- `backend/`: the API and database, deployed as a Cloudflare Worker with a Turso database. See [backend/README.md](backend/README.md).

## Run it locally

You need [Bun](https://bun.sh).

```bash
cd backend
bun install
cp .env.example .env
bun run db:import db/fighters.example.csv
bun run dev
```

Then in a second terminal:

```bash
cd frontend
bun install
bun run dev
```

Open http://localhost:5173.

## Common tasks

All of these run in `backend/`.

| Task | Command |
| --- | --- |
| Add or update fighters | `bun run db:import fighters.csv` (see [the CSV format](backend/README.md#fighters-csv)) |
| Add a fighter image | `bun run images photo.png cat`, then set `image_url` to `/fighters/cat.webp` in the CSV |
| Start the local database over | `bun run db:reset` |
| Deploy | `bun run deploy` (first time: see [Deploying](backend/README.md#deploying)) |
