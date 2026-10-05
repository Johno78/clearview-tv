# Clearview

An Xtream Codes player for Fire TV / Android TV, with a glassy, tile-based interface inspired by modern set-top boxes.
It is **just a player**: users enter their own server, username and password. No channels or content are included.

## Features
- Xtream Codes sign-in (server / username / password) + a built-in demo mode
- Live TV with category rail, search, now-playing info, favourites
- TV guide (EPG grid) built from `get_short_epg`
- Movies and Series with details, seasons/episodes, auto-play next episode
- Continue watching (resume positions saved on the device)
- Remote-first: D-pad navigation, Back, Menu (☰) to favourite, channel up/down, media keys
- In the live player: ▲▼ change channel · ◀ channel list · ▶ favourite · OK info

## Playing in VLC
Settings → **Player** lets you choose Built-in, VLC, or "Choose app" for live TV, movies and episodes.
Movie pages also have a **Play in VLC** button. If the built-in player can't play a stream, press OK on the error
screen to open it in VLC. Install VLC from the Fire TV app store first. Live streams are sent to VLC as `.ts`
when your provider allows it (falls back to `.m3u8`).

## Get the APK (no Android Studio needed)
1. Push this folder to a GitHub repo (branch `main`).
2. The **Build Fire TV APK** workflow runs automatically (Actions tab) and publishes `clearview.apk` to the **latest** release.
3. On the Firestick install **Downloader**, then enter:
   `https://github.com/<you>/<repo>/releases/download/latest/clearview.apk`
   (Settings → My Fire TV → Developer options → Install unknown apps → Downloader.)

## Try it in a browser
Open `www/index.html` and choose **Try the demo**. (Real Xtream servers won't work from a browser tab:
they're usually plain http and don't send CORS headers. Inside the APK, Capacitor's native HTTP layer is used instead.)

## Dev
```
npm install
npm run prep          # copies hls.js into www/
node scripts/smoke.js # headless smoke test (demo mode)
```

## Known limits / next steps
- Playback uses the WebView (`<video>` + hls.js). Live uses HLS (`.m3u8`). Some movie containers (`.mkv`) or
  raw `.ts` streams may not play in a WebView; the upgrade path is a native ExoPlayer plugin.
- EPG is per-channel (`get_short_epg`), not a full XMLTV import.
- Debug-signed APK (fine for sideloading).

## Sharing the app
- Download page: `docs/index.html` (publish with Settings → Pages → Deploy from branch → `main` / `/docs`).
- Direct link: `https://github.com/Johno78/clearview-tv/releases/download/latest/clearview.apk`
- **Signing key (so people can update without uninstalling):** add two repository secrets under
  Settings → Secrets and variables → Actions: `KEYSTORE_B64` (base64 of your `.jks`) and `KEYSTORE_PASSWORD`.
  Without them the build falls back to a debug-signed APK. Keep a backup of the keystore: if it's lost, existing
  installs can't be updated.
