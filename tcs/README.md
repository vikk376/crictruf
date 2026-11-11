# CricTruf (tennis-ball, turf, box and gully cricket)

Yellow, white and black mobile app with **DIC ground-zone scoring**, ball-by-ball scoring, offline storage,
scorecards, analytics, tournaments and a 4 / 6 celebration background.

## Get the APK (pick one)

### A) GitHub Actions: no installs, about 5 minutes
1. Create a new GitHub repository and upload everything in this folder (keep the `.github` folder).
2. Open the repo's **Actions** tab, choose **Build Android APK**, press **Run workflow**.
3. When it finishes, open the run and download the artifact **CricTruf-debug-apk**. Unzip it, copy `app-debug.apk` to your phone and install it (allow "install unknown apps" once).

### B) Android Studio
1. Open the `android` folder in Android Studio and let Gradle sync.
2. **Build > Build Bundle(s) / APK(s) > Build APK(s)**. The APK is in `android/app/build/outputs/apk/debug/`.
3. Command line alternative: `cd android && ./gradlew assembleDebug` (needs JDK 17 and the Android SDK).

### C) Use it right now as an installable web app (no APK)
Host the `www` folder on any HTTPS site (GitHub Pages, Netlify, Cloudflare Pages), open it in Chrome on your phone,
and choose **Add to Home screen**. It works offline after the first load.
`CricTruf.html` is the same app in one file for a quick trial.

## Project layout
- `www/` the whole app (HTML/CSS/JS). Shared by the PWA and the APK.
- `www/js/engine.js` scoring engine (pure logic). `tests/engine.test.js` tests it (`node tests/engine.test.js`).
- `android/` Android Studio project: a native WebView shell that bundles `www/` as assets.

## How the ground and DIC scoring work
The ground is a box with the batter at the top and the bowler end at the bottom.
- **Zone 1** = the near ring around the pitch. **Zone 2** = the grey area beside the pitch. Only these two are DIC zones (default 1 run, same striker until the over ends). The rest is fixed: Middle 2, Outer 3 (strike changes), Boundary 4, over the net 6. Turf is dark green.
  At the start of a match you choose how each scores (on/off, runs, change strike). Default: 1 run and the same striker, so the strike only changes when the over completes.
- **Front field** = 11 shot sectors (reverse sweep, late cut, cut, cover, mid off, straight drive, straight lofted, mid on, flick, sweep, paddle sweep), each split into Near, Middle, Outer, Boundary (4) and Over the net (6). 4 and 6 exist only here.
- Scoring screen > **DIC Ground** > tap where the ball went > check runs/strike > **Confirm**. Override a single ball with -1 / +1 / Strike.
- Edit every zone in **More > DIC zone presets** (one preset per turf or tournament). Each match keeps its own copy.
The shot and zone are saved with every ball and drive the Analytics heatmap and "most targeted shots".

## What is in this version
Match setup (overs, venue, turf, XI, subs, captain, wicketkeeper, toss), live scoring (0-6, wide, no-ball, bye, leg-bye, wicket types incl. one-tip-one-hand,
free hit, retire, last-man batting, super over, local rule shots such as roof / side wall / net touch), undo and manual correction with audit log,
live board, scorecards, player profiles and rankings, tournaments (league, knockout, semi-final, final, points table, NRR, leaderboard),
analytics (zone heatmap, ring distribution, dot / boundary %, over-by-over, partnerships), dark and light mode, local roles (Admin / Scorer / Viewer),
backup and restore.

## Known limits (be aware)
- Data lives on the phone (offline-first). There is **no cloud backend**: login/roles are local to the device, and multi-device live updates need a server.
  The Admin screen has a "Sync" hook that POSTs changed matches to `<your server>/api/sync`; the server side is not included.
- The debug APK is signed with the Android debug key (fine for sideloading, not for Play Store). For Play Store create a release keystore.
