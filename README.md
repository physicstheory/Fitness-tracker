# RepRise: Rep Tracker & AI Coach

A mobile-first web app for tracking reps, with built-in rest timers and an AI coach. It's modelled on the Push-Up Challenge app: pick a challenge, tap to count your reps, rest between sets, and watch your streak grow.

## Features

- **Tap-to-count rep tracker.** A big counter button with sounds and vibration, set targets (including max-effort sets), and +/- correction. On desktop, Space counts a rep and Enter finishes the set.
- **Rest and cooldown timers.** A rest countdown starts automatically after each set, using that exercise's rest time from the program. You can add or remove 15 seconds or skip it, and it beeps for the last 3 seconds.
- **Timed exercises.** Planks and wall sits get a 3-2-1 get-ready countdown, then a countdown or stopwatch with pause.
- **Built-in challenges.** 100 Push-Up Challenge (classic 6-week progression plus a final test), Squat Challenge, Plank Builder and Full Body Starter.
- **Add programs with Claude (no API key needed).** **Open Claude** starts a new chat in the Claude app with the conversion instructions already filled in. Attach your program file, send, copy Claude's reply, and tap **Paste from Claude**. RepRise turns it into a program with every session, set, rep target, rest period and exercise instructions.
- **Spotify.** Paste a playlist link to get Spotify's player inside workouts, with no sign-in. Or connect your Spotify account to pick a workout playlist, see what's playing, skip songs, and start the music automatically with each workout. Controlling playback needs Spotify Premium.
- **AI coaching per exercise.** Step-by-step instructions, cues, breathing, regressions and progressions, tailored to your level, injuries and recent sets.
- **Goals with AI plans.** Set a target, for example 100 push-ups in one set, 500 squats in a day, or a cumulative total, with a deadline. The AI checks whether it's realistic, writes weekly milestones, and builds a full program to get you there.
- **Coach chat.** Ask about form, plateaus or recovery. The coach can see your history, goals and active program.
- **Progress tracking.** Daily ring and target, streaks, a week strip, a bar chart (7, 14 or 30 days, per exercise), a 16-week heatmap, personal records and workout history.
- **Installable PWA.** Add it to your home screen, and it keeps working offline after the first visit (AI features need a connection). Light and dark modes are supported.

Your data is stored on your device in local storage. Use **Settings → Export** to back it up or move it to another device.

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
