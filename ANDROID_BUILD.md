# ToteTrack Android APK build guide (online wrapper)

This folder prepares ToteTrack for an Android APK using Capacitor. It is **not a compiled APK yet**. The APK needs a deployed HTTPS backend/site and Android Studio/SDK to build.

## Architecture

The APK opens the deployed ToteTrack site in an Android WebView. The deployed Node.js/Express app serves the frontend and API, and MongoDB Atlas stores data. This avoids maintaining a separate Android UI during the short CITE 006A deadline. It requires internet access.

## A. Deploy the backend first

1. Push this project to your own GitHub repository.
2. Create a MongoDB Atlas database and database user. In Network Access, configure access for your host according to the provider's current instructions. Do not commit secrets.
3. On Render, create a **Web Service** from your repository. Build command: `npm install`; start command: `npm start`.
4. Set `MONGODB_URI` in Render's environment variables to your Atlas connection string.
5. Deploy and open `https://YOUR-RENDER-SERVICE.onrender.com/health`. It should return JSON with `ok: true`. Then open the root URL and test importing a race and placing a virtual bet.
6. Confirm your Render service has HTTPS and note the exact public hostname.

## B. Point the Android wrapper at your deployed site

Edit `capacitor.config.json`. Replace both occurrences of `YOUR-RENDER-SERVICE.onrender.com` with the actual Render hostname. Set `server.url` to the full HTTPS URL, e.g. `https://totetrack-example.onrender.com`. Do not include a trailing `/health`.

## C. Generate the Android project

Requirements: Node.js 20+, Android Studio, Android SDK, and a compatible JDK (Android Studio's bundled JBR is recommended).

From this folder, run:

```bash
npm install
npx cap add android
npx cap sync android
npx cap open android
```

In Android Studio, wait for Gradle sync. Select **Build > Build Bundle(s) / APK(s) > Build APK(s)**. When finished, click the notification's **Locate** link. The debug APK is typically at `android/app/build/outputs/apk/debug/app-debug.apk`.

For a shareable release build, use **Build > Generate Signed Bundle / APK > APK** and create/store your signing key safely. Never upload the keystore or passwords to GitHub.

## D. Test on your phone

1. Copy `app-debug.apk` to your Android phone.
2. Allow installation from that source if Android asks, then install.
3. Connect to the internet and test refresh, race import, virtual bet, close betting, simulate race, settle payouts, and bet history.
4. Test after a full app close/reopen. Some free hosting plans sleep when idle; the first request may take a while.

## Important caveats

- This is an online WebView wrapper, not an offline-native app. The deployed service must remain available and the phone needs internet.
- The current classroom starter has one shared demo wallet and no authentication. Anyone using the public site may share that wallet/data. Do not treat it as real-money betting or expose sensitive information. Consider adding login and per-user wallets before public use.
- Do not use actual money. This app is an educational simulator using virtual credits only.
- The `server.url` approach loads your hosted site. If you later want a self-contained APK that bundles the UI locally, remove `server.url`, use a configurable API base URL and enable CORS on the Express backend; that is a separate setup.
