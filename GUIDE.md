# Guided coding tour (read alongside the code)

This is a build-first learning guide. Don't just run the project: change one small thing, test it, and commit it.

## Step 1 — Understand the request path
Browser `public/app.js` calls `/api/...` using `fetch`. `server.js` sends `/api` requests to `src/routes.js`. Routes read or update Mongoose models, which persist data in MongoDB.

Try: open `http://localhost:3000/health` and note the JSON response.

## Step 2 — Start the app
- `npm install`
- Copy `.env.example` to `.env`
- Add a valid `MONGODB_URI`
- `npm run dev`
- Open `http://localhost:3000`

If the app says `Missing MONGODB_URI`, your `.env` is missing or incorrectly named. Make sure the file is literally `.env`, not `.env.example.txt`.

## Step 3 — Learn the import format
Download the metadata and CSV templates from the page. Keep the CSV header exact. Metadata is intentionally simple `key=value` text so it is easy to create in a text editor.

Try these experiments:
1. Remove `venue=...` and import; explain the validation error.
2. Change a horse number to a duplicate; explain the error.
3. Add a third horse.
4. Import a race with a Japanese horse name encoded as UTF-8. If your source is CP932, test that file too.

The importer uses `csv-parse` rather than splitting each row at commas because horse names and race titles may contain punctuation.

## Step 4 — Understand CRUD
- Create: import a new race or use `POST /api/races`.
- Read: `GET /api/races` and `GET /api/races/:id`.
- Update: `PUT /api/races/:id` and `PUT /api/races/:id/horses/:horseId`.
- Delete: `DELETE /api/races/:id` and `DELETE /api/races/:id/horses/:horseId`.

The page exposes import, read, and race deletion. For a complete CRUD demonstration, use an API client such as Postman/Thunder Client for the update and horse endpoints, or add edit controls as your next improvement.

## Step 5 — Trace one bet
1. Start with 10,000 demo credits.
2. Import a race.
3. Place a 100-credit bet.
4. Notice the balance falls to 9,900.
5. Close betting.
6. Simulate the race.
7. Settle payouts.
8. Check the wallet and bet history.

A race must be closed before it can be simulated, and simulated before settlement. Settlement has a guard against running twice.

## Step 6 — Check the formula by hand
Suppose the pool is 1,000 credits, takeout is 10%, and winning bets total 200 credits:
- Net pool = 1,000 × 0.90 = 900.
- Return per winning credit = 900 / 200 = 4.5.
- A 20-credit winning ticket receives floor(900 × 20 / 200) = 90 credits.
- Net profit on that ticket = 90 − 20 = 70 credits.

The payout is a gross return, not profit. The original stake is already deducted when the bet is placed.

## Step 7 — GitHub habits
Make small commits after each working feature. Example messages:
- `chore: initialize express app`
- `feat: add race import parser`
- `feat: calculate win pool payouts`
- `feat: add racecard interface`
- `fix: prevent settlement twice`

Create a feature branch and merge it through a GitHub pull request to satisfy the assignment requirement.

## Step 8 — What to say in your presentation
Be prepared to answer:
- Why use MongoDB? Racecards and bets are nested/variable data, and Mongoose provides schemas and validation.
- What is CRUD? Create, Read, Update, Delete.
- What is parimutuel betting? Stakes are pooled; after takeout, the net pool is divided among winning tickets proportional to stake.
- Why are odds indicative? The pool can change until betting closes.
- Why no real money? This is a controlled educational simulation.
- What are the limitations? Demo wallet/no authentication, simplified payout rules, randomized ability, and no live official data integration.
