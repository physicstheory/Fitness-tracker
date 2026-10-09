import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, ListMusic, Music, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import * as spotify from "../lib/spotify";
import { setState, useAppState } from "../store";
import { Sheet, Switch } from "./ui";

export function useSpotifyConnected(): boolean {
  const [connected, setConnected] = useState(spotify.isConnected());
  useEffect(() => {
    const update = () => setConnected(spotify.isConnected());
    window.addEventListener("spotify-change", update);
    return () => window.removeEventListener("spotify-change", update);
  }, []);
  return connected;
}

const setMusic = (workoutMusic: { uri: string; name: string; image?: string } | undefined) =>
  setState((s) => ({ ...s, settings: { ...s.settings, workoutMusic } }));

/** Settings card: connect Spotify, pick a workout playlist, or paste a playlist link. */
export function MusicSettings({ notice }: { notice?: string }) {
  const state = useAppState();
  const connected = useSpotifyConnected();
  const [profile, setProfile] = useState<{ display_name: string; product: string } | null>(null);
  const [picking, setPicking] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState(notice ?? "");
  const music = state.settings.workoutMusic;
  const hasClientId = Boolean(spotify.clientId());

  useEffect(() => {
    if (!connected) return setProfile(null);
    spotify.getProfile().then(setProfile, (e) => setError((e as Error).message));
  }, [connected]);

  function applyLink(value: string) {
    setLink(value);
    if (!value.trim()) return;
    const parsed = spotify.parseSpotifyLink(value);
    if (!parsed) return setError("That isn't a Spotify link. In Spotify tap Share → Copy link.");
    setError("");
    setMusic({ uri: parsed.uri, name: parsed.uri.startsWith("spotify:playlist") ? "Linked playlist" : "Linked music" });
    setLink("");
  }

  return (
    <div className="card col" style={{ gap: 12 }}>
      <div className="row">
        <span className="emoji-badge" style={{ background: "#1db954" }}>
          <Music color="#fff" size={20} />
        </span>
        <div className="grow">
          <div style={{ fontWeight: 750 }}>Spotify</div>
          <div className="small muted">
            {connected ? `Connected${profile ? ` as ${profile.display_name}` : ""}` : "Play your workout music inside the app"}
          </div>
        </div>
        {connected && (
          <button className="btn sm ghost" onClick={spotify.disconnect}>
            Disconnect
          </button>
        )}
      </div>

      {connected && profile && profile.product !== "premium" && (
        <div className="banner">Spotify Free can't be controlled by other apps. Your playlist will show as a player you tap to play instead.</div>
      )}

      {music ? (
        <div className="card flat row" style={{ padding: 10 }}>
          {music.image ? <img src={music.image} alt="" width={44} height={44} style={{ borderRadius: 8 }} /> : <span className="emoji-badge"><ListMusic size={20} /></span>}
          <div className="grow" style={{ minWidth: 0 }}>
            <span className="eyebrow">Workout music</span>
            <div className="ellipsis" style={{ fontWeight: 700 }}>
              {music.name}
            </div>
          </div>
          <button className="btn sm ghost danger" onClick={() => setMusic(undefined)}>
            Remove
          </button>
        </div>
      ) : null}

      {connected ? (
        <>
          <button className="btn block" onClick={() => setPicking(true)}>
            <ListMusic size={16} /> {music ? "Change playlist" : "Choose workout playlist"}
          </button>
          <Switch label="Start music with workouts" hint="Plays your playlist when you tap Start workout (Premium)" on={state.settings.autoPlayMusic} onChange={(v) => setState((s) => ({ ...s, settings: { ...s.settings, autoPlayMusic: v } }))} />
        </>
      ) : hasClientId ? (
        <button className="btn block" style={{ background: "#1db954", color: "#fff", border: 0 }} onClick={() => spotify.connect().catch((e) => setError((e as Error).message))}>
          Connect Spotify
        </button>
      ) : null}

      {!connected && (
        <label className="field">
          {hasClientId ? "Or just paste a playlist link (no sign-in)" : "Paste a Spotify playlist link"}
          <input className="input" placeholder="https://open.spotify.com/playlist/…" value={link} onChange={(e) => applyLink(e.target.value)} />
        </label>
      )}

      {error && <div className="banner error">{error}</div>}

      {!connected && (
        <button className="row small muted" style={{ fontWeight: 650, gap: 4 }} onClick={() => setShowSetup((v) => !v)}>
          {showSetup ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {hasClientId ? "Spotify connection settings" : "Set up full Spotify connection"}
        </button>
      )}
      {showSetup && !connected && (
        <div className="col small" style={{ gap: 8 }}>
          <ol className="clean muted" style={{ paddingLeft: 18 }}>
            <li>
              Go to <b>developer.spotify.com/dashboard</b> and create an app (any name).
            </li>
            <li>
              Add this Redirect URI: <code style={{ wordBreak: "break-all" }}>{spotify.redirectUri()}</code>
            </li>
            <li>Tick "Web API", save, and copy the app's Client ID here.</li>
          </ol>
          <input
            className="input"
            placeholder="Spotify Client ID"
            value={state.settings.spotifyClientId ?? ""}
            onChange={(e) => setState((s) => ({ ...s, settings: { ...s.settings, spotifyClientId: e.target.value.trim() } }))}
          />
          <p className="faint">Spotify only allows https:// addresses (or http://127.0.0.1 for testing).</p>
        </div>
      )}

      <PlaylistPicker open={picking} onClose={() => setPicking(false)} />
    </div>
  );
}

function PlaylistPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [lists, setLists] = useState<spotify.SpotifyPlaylist[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setError("");
    spotify.getPlaylists().then(setLists, (e) => setError((e as Error).message));
  }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title="Workout playlist">
      {error && <div className="banner error">{error}</div>}
      {!lists && !error && (
        <div className="row" style={{ justifyContent: "center", padding: 24 }}>
          <span className="spinner" style={{ color: "#1db954" }} />
        </div>
      )}
      {lists?.length === 0 && <p className="muted">No playlists found in your Spotify library.</p>}
      <div className="list">
        {lists?.map((p) => (
          <button
            key={p.id}
            className="list-item"
            onClick={() => {
              setMusic({ uri: p.uri, name: p.name, image: p.image });
              onClose();
            }}
          >
            {p.image ? <img src={p.image} alt="" width={44} height={44} style={{ borderRadius: 8, objectFit: "cover" }} /> : <span className="emoji-badge"><ListMusic size={20} /></span>}
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="ellipsis" style={{ fontWeight: 700 }}>
                {p.name}
              </div>
              <div className="small muted">{p.tracks} songs</div>
            </div>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/**
 * Music bar inside the workout player. With a Spotify connection it shows the current song with
 * playback controls; otherwise it shows Spotify's embedded player for the chosen playlist.
 * It stays mounted while hidden so the embedded player keeps playing.
 */
export function WorkoutMusic({ visible, autoStart }: { visible: boolean; autoStart: boolean }) {
  const state = useAppState();
  const connected = useSpotifyConnected();
  const music = state.settings.workoutMusic;
  const [now, setNow] = useState<spotify.NowPlaying | null>(null);
  const [error, setError] = useState("");
  const [autoStarted, setAutoStarted] = useState(false);

  const refresh = useCallback(() => {
    spotify.nowPlaying().then(setNow, () => setNow(null));
  }, []);

  useEffect(() => {
    if (!connected) return;
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [connected, refresh]);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setError("");
      try {
        await fn();
        setTimeout(refresh, 600);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [refresh],
  );

  useEffect(() => {
    if (!autoStart || autoStarted || !connected || !music || !state.settings.autoPlayMusic) return;
    setAutoStarted(true);
    void run(() => spotify.play(music.uri));
  }, [autoStart, autoStarted, connected, music, state.settings.autoPlayMusic, run]);

  if (!connected && !music) return null;
  const embed = music ? spotify.embedUrlFor(music.uri) : null;

  return (
    <div style={{ display: visible ? "block" : "none" }}>
      {connected ? (
        <div className="card flat col" style={{ padding: 10, gap: 8 }}>
          <div className="row">
            {now?.image ? (
              <img src={now.image} alt="" width={42} height={42} style={{ borderRadius: 8 }} />
            ) : (
              <span className="emoji-badge" style={{ width: 42, height: 42, background: "#1db954" }}>
                <Music color="#fff" size={18} />
              </span>
            )}
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="ellipsis small" style={{ fontWeight: 700 }}>
                {now?.track ?? (music ? music.name : "Nothing playing")}
              </div>
              <div className="ellipsis faint" style={{ fontSize: 12 }}>
                {now?.artist ?? "Spotify"}
              </div>
            </div>
            <button className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => run(spotify.previous)} aria-label="Previous song">
              <SkipBack size={16} />
            </button>
            <button
              className="icon-btn"
              style={{ width: 42, height: 42, background: "#1db954", border: 0, color: "#fff" }}
              onClick={() => run(() => (now?.isPlaying ? spotify.pause() : spotify.play(now?.track ? undefined : music?.uri)))}
              aria-label={now?.isPlaying ? "Pause music" : "Play music"}
            >
              {now?.isPlaying ? <Pause size={18} fill="#fff" /> : <Play size={18} fill="#fff" />}
            </button>
            <button className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => run(spotify.next)} aria-label="Next song">
              <SkipForward size={16} />
            </button>
          </div>
          {music && now && now.contextUri !== music.uri && (
            <button className="btn sm ghost" onClick={() => run(() => spotify.play(music.uri))}>
              <ListMusic size={14} /> Play {music.name}
            </button>
          )}
          {error && <p className="small" style={{ color: "var(--warn)" }}>{error}</p>}
        </div>
      ) : embed ? (
        <iframe
          title="Spotify player"
          src={embed}
          width="100%"
          height="80"
          style={{ border: 0, borderRadius: 12, display: "block" }}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      ) : null}
    </div>
  );
}
