# Deployment checklist for the authentication update

1. Back up the current MongoDB Atlas database before deploying.
2. Set `MONGODB_URI`, `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `NODE_ENV=production`, and optionally `STARTING_CREDITS` in Render.
3. Use a unique admin username that has never been used for public registration. The app will not silently promote an existing user account.
4. Deploy the repository. Confirm `/health` reports `database: connected`.
5. Log in with the configured admin account; register a separate normal user in a private/incognito browser to test permissions.
6. Verify normal users receive 403 responses for admin routes and cannot access race creation/results controls.
7. Test using a newly created race and small virtual stakes before using existing races.
8. Only after testing should you update/rebuild the Android APK. It is a web wrapper and requires internet access.

Never commit `.env`, session secrets, MongoDB credentials, or administrator passwords to GitHub.
