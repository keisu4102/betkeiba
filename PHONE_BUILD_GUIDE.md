# ToteTrack APK build using only an Android phone

This workflow builds a debug APK in GitHub Actions, so Android Studio is not needed on your phone. It does not automatically deploy the backend or create the MongoDB database.

## 1. Upload the project to GitHub

1. Download and extract `totetrack-android-project.zip` using your phone's Files app.
2. In a browser, sign in to GitHub and create a new repository named `totetrack`.
3. Upload the extracted project files/folders to the repository's `main` branch. Make sure `.github/workflows/build-apk.yml` is included. If the mobile browser cannot upload folders, use GitHub Codespaces or a browser-based terminal to upload/extract the ZIP instead.

## 2. Deploy the web backend first

1. Create a MongoDB Atlas database and a database user. Keep the connection string private.
2. In Render, create a Web Service connected to this GitHub repository.
3. Set Build Command to `npm install`, Start Command to `npm start`, and add `MONGODB_URI` under Environment Variables.
4. Deploy, then test `https://YOUR-SERVICE.onrender.com/health` and open the root website. Confirm it works before building the APK.

## 3. Configure the APK build

1. In the GitHub repository, open Settings → Secrets and variables → Actions → Variables → New repository variable.
2. Name: `TOTETRACK_SITE_URL`
3. Value: your deployed HTTPS URL, for example `https://your-service.onrender.com` (no `/health`).
4. Save the variable. Open Actions → Build ToteTrack APK → Run workflow. A push to `main` also triggers a build.

## 4. Download the APK on your phone

1. Open the successful workflow run in GitHub Actions.
2. Under Artifacts, tap `ToteTrack-debug-apk` to download it.
3. Extract the downloaded artifact ZIP if needed, then tap `app-debug.apk` in Files to install it. Android may ask you to allow installs from your browser or Files app.

## Important

- The APK is an online wrapper around the deployed website. Internet access is required.
- The backend must be deployed and `TOTETRACK_SITE_URL` must be set before the workflow can build a usable APK.
- This is a classroom-only virtual-credit simulator, not real-money betting.
- Never put your MongoDB connection string, database password, or signing keys in source code or public GitHub files.
