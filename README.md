# Betkeiba

Betkeiba is an educational horse-racing parimutuel simulator using Node.js, Express, MongoDB, and a mobile-friendly web interface. It uses **virtual credits only** and has no real-money deposit or withdrawal feature.

## Features

- Account registration and login; passwords are bcrypt-hashed.
- Separate wallet and betting history for each account.
- Regular users can browse races, check indicative pool returns, and place bets.
- Administrator-only race creation, CSV/TXT import, race controls, account management, and credit adjustments.
- Administrators can enter official real-world finishing orders manually after closing betting, then settle the parimutuel pool.
- An optional fictional race simulation is clearly labeled separately from manually entered official results.
- No races are preloaded by default.

## Deploying on Render

Set these environment variables in Render's service settings:

- `MONGODB_URI`: your MongoDB Atlas connection string.
- `SESSION_SECRET`: a long, randomly generated secret. Do not commit it to GitHub.
- `ADMIN_USERNAME`: a unique username for the first administrator. Do not register this username as a public user first.
- `ADMIN_PASSWORD`: a strong password for the initial administrator.
- `NODE_ENV=production`
- Optional `STARTING_CREDITS=10000`

The app creates the initial administrator on startup if that username does not exist. If a regular account already uses that username, the app deliberately will **not** promote it; choose an unused administrator username instead. Keep all secrets in Render environment settings, never in source code.

Build command: `npm install`
Start command: `npm start`

## Important migration note

This update changes the app from a shared demo wallet to user-specific wallets and requires a MongoDB-backed session store. Existing race documents are retained, but bets created under the old shared `demo` account are not automatically assigned to a new user. Back up your MongoDB database before deploying. Do not point this code at important data without a backup.

## Race result workflow

1. Admin closes betting.
2. Admin opens the race and enters each runner's official finishing position. Leave non-finishers blank; positions must be unique.
3. Admin saves the result and verifies the order.
4. Admin selects **Settle payouts**. Settlement locks the race against a second settlement and credits winning tickets (or refunds stakes if no tickets backed the winner).

This is a manual data-entry simulator; it does not automatically verify official results against JRA or other racing authorities. Review results carefully before settlement.

## Android APK

The repository's GitHub Actions workflow wraps the deployed website in a Capacitor Android shell. Configure the repository variable `BETKEIBA_SITE_URL` with the public HTTPS Render URL, then run **Actions → Build Betkeiba APK**. The APK needs an internet connection and uses the deployed site, so the site must also be running.
