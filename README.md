# RepRise: Rep Tracker & AI Coach

A mobile-first web app for tracking reps, with built-in rest timers and an AI coach. It's modelled on the Push-Up Challenge app: pick a challenge, tap to count your reps, rest between sets, and watch your streak grow.

## Features

- **Tap-to-count rep tracker.** A big counter button with sounds and vibration, set targets (including max-effort sets), and +/- correction. On desktop, Space counts a rep and Enter finishes the set.
- **Rest and cooldown timers.** A rest countdown starts automatically after each set, using that exercise's rest time from the program. You can add or remove 15 seconds or skip it, and it beeps for the last 3 seconds.
- **Timed exercises.** Planks and wall sits get a 3-2-1 get-ready countdown, then a countdown or stopwatch with pause.
- **Liftoff-style progression.** Earn XP for every set and level up. Each muscle has a rank from Bronze to Legend, shown on a body map.
- **Smart coach (works offline).** A recovery map, today's suggested focus, push/pull and quad/hamstring balance, weekly sets per muscle, and progressive-overload targets ("You hit every set at 20 kg, go to 22 kg"). Tips also appear during your sets.
- **Workout generator and builder.** Generate a session from a focus, the time you have, and your level, equipment and recovery. Or build your own routine with sets, reps, weight and rest, and save it for one-tap starts.
- **127-exercise library** with muscle-group filters and equipment awareness.
- **Muscle map and form animations.** 50+ animated movements use a shaded mannequin figure with "Lower / Press" phase cues. Before every workout, and in each exercise's guide, see front and back body diagrams with the worked muscles pulsing orange, or an animated figure showing how to do the movement.
- **Equipment and gym training.** Tick the equipment you own on the Today screen to filter exercises and flag programs that need more. Includes 16 dumbbell, barbell, kettlebell, cable and machine exercises, weight logging per set (kg or lb), heaviest-lift records, and Dumbbell Starter and Gym Strength 5×5 programs.
- **Built-in challenges.** 100 Push-Up Challenge (classic 6-week progression plus a final test), Squat Challenge, Plank Builder and Full Body Starter.
- **Add programs with Claude (no API key needed).** **Open Claude** starts a new chat in the Claude app with the conversion instructions already filled in. Attach your program file, send, copy Claude's reply, and tap **Paste from Claude**. RepRise turns it into a program with every session, set, rep target, rest period and exercise instructions.
- **Spotify.** Paste a playlist link to get Spotify's player inside workouts, with no sign-in. Or connect your Spotify account to pick a workout playlist, see what's playing, skip songs, and start the music automatically with each workout. Controlling playback needs Spotify Premium.
- **AI coaching per exercise.** Step-by-step instructions, cues, breathing, regressions and progressions, tailored to your level, injuries and recent sets.
- **Goals with AI plans.** Set a target, for example 100 push-ups in one set, 500 squats in a day, or a cumulative total, with a deadline. The AI checks whether it's realistic, writes weekly milestones, and builds a full program to get you there.
- **Coach chat.** Ask about form, plateaus or recovery. The coach can see your history, goals and active program.
- **Progress tracking.** Daily ring and target, streaks, a week strip, a bar chart (7, 14 or 30 days, per exercise), a 16-week heatmap, personal records and workout history.
- **Installable PWA.** Add it to your home screen, and it keeps working offline after the first visit (AI features need a connection). Light and dark modes are supported.

Your data is stored on your device in local storage. Use **Settings → Export** to back it up or move it to another device.

## iPhone app (sideload)

RepRise is also a native iOS app, built with Capacitor. Every push builds an unsigned `RepRise.ipa` on GitHub Actions (**Actions → iOS app**). Each build is also published under **Releases** as `ios-build-N`.

To install it:

1. Download **RepRise.ipa** from the latest `ios-build-N` release.
2. Install **Sideloadly** (Windows/Mac, sideloadly.io) or **AltStore** (altstore.io).
3. Plug in your iPhone, drag the `.ipa` into Sideloadly, sign in with your Apple ID, and click Start.
4. On the iPhone, go to **Settings → General → VPN & Device Management**, tap your Apple ID and choose **Trust**.
5. On iOS 16 and later, turn on **Settings → Privacy & Security → Developer Mode** and restart.

With a free Apple ID the app has to be re-signed every 7 days. Sideloadly or AltStore can refresh it, and your data stays on the phone.

The app works fully offline. The coach and program import use your Claude app. To use the server's in-app AI as well, enter your server address under **Settings → AI server**, or set a repository variable `API_BASE` before building.

## Running it

Requires Node 22+.

```bash
npm install
cp .env.example .env      # then put your Anthropic API key in .env
npm run dev               # API on :8787, web app on http://localhost:5173
```

To use it from your phone on the same Wi-Fi, open `http://<your-computer-ip>:5173`.

### Production

```bash
npm run build
npm start                 # serves the app and API on http://localhost:8787
```

Deploy anywhere that runs Node (Render, Railway, Fly.io, a VPS). Set `ANTHROPIC_API_KEY` in the host's environment. Serve it over HTTPS so phones can install it and keep the screen awake during workouts.

## AI

The server (`server/`) calls Claude through the official `@anthropic-ai/sdk`:

| Endpoint | What it does |
| --- | --- |
| `POST /api/exercises/instructions` | Personalised exercise guide |
| `POST /api/goals/plan` | Feasibility, weekly milestones and a full program for a goal |
| `POST /api/coach/chat` | Coach chat with your training context |

It uses `claude-opus-5-5` by default (override with `ANTHROPIC_MODEL`), with server-side refusal fallbacks turned on. These API features are optional. Without an API key the app still works fully as a tracker, and adding programs goes through the Claude app instead.

## Spotify setup (optional)

Pasting a playlist link works with no setup. For the full connection:

1. Create an app at https://developer.spotify.com/dashboard and tick "Web API".
2. Add your site's address as a Redirect URI, for example `https://your-app.onrender.com/`. Spotify only accepts `https://`, or `http://127.0.0.1:5173/` for local testing.
3. Put the Client ID in `.env` as `VITE_SPOTIFY_CLIENT_ID` before building, or paste it into **Settings → Spotify** in the app.

While a Spotify app is in development mode, only accounts you add under **User Management** in the Spotify dashboard can connect.

## Project layout

```
server/        Express API + Claude integration
src/screens/   Today, Programs, Workout player, Import, Goals, Progress, Coach, Settings
src/components UI primitives, AI exercise guide
src/data/      Built-in exercises and challenges
src/store.ts   Local-storage state
```
