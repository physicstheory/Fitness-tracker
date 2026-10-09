import { getState } from "../store";

// Spotify sign-in uses the PKCE flow, so it runs entirely in the browser with no client secret.
const TOKEN_KEY = "reprise:spotify-token";
const PKCE_KEY = "reprise:spotify-pkce";
const SCOPES = ["user-read-private", "playlist-read-private", "playlist-read-collaborative", "user-read-playback-state", "user-modify-playback-state", "user-read-currently-playing"];

interface Token {
  access: string;
  refresh: string;
  expiresAt: number;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  uri: string;
  image?: string;
  tracks: number;
}

export interface NowPlaying {
  isPlaying: boolean;
  track?: string;
  artist?: string;
  image?: string;
  contextUri?: string;
}

export const redirectUri = () => `${location.origin}/`;

export function clientId(): string {
  return (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined) || getState().settings.spotifyClientId?.trim() || "";
}

function readToken(): Token | null {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) ?? "null");
  } catch {
    return null;
  }
}

function writeToken(t: Token | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked; the user will need to reconnect next visit.
  }
  window.dispatchEvent(new Event("spotify-change"));
}

export const isConnected = () => readToken() !== null;
export const disconnect = () => writeToken(null);

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export async function connect() {
  const id = clientId();
  if (!id) throw new Error("Add your Spotify Client ID first.");
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(64)));
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state }));
  const params = new URLSearchParams({
    client_id: id,
    response_type: "code",
    redirect_uri: redirectUri(),
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
    scope: SCOPES.join(" "),
  });
  location.assign(`https://accounts.spotify.com/authorize?${params}`);
}

async function tokenRequest(body: Record<string, string>): Promise<Token> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId(), ...body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || "Spotify sign-in failed.");
  return { access: data.access_token, refresh: data.refresh_token ?? body.refresh_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
}

/** Finishes sign-in when Spotify redirects back with ?code=. Returns an error message, if any. */
export async function handleRedirect(): Promise<string | null> {
  const url = new URL(location.href);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  if (!code && !error) return null;
  const saved = JSON.parse(sessionStorage.getItem(PKCE_KEY) ?? "null") as { verifier: string; state: string } | null;
  history.replaceState(null, "", url.pathname);
  sessionStorage.removeItem(PKCE_KEY);
  if (error) return error === "access_denied" ? "Spotify connection cancelled." : `Spotify error: ${error}`;
  if (!saved || saved.state !== state) return "Spotify sign-in expired. Please try again.";
  try {
    writeToken(await tokenRequest({ grant_type: "authorization_code", code: code!, redirect_uri: redirectUri(), code_verifier: saved.verifier }));
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

async function accessToken(): Promise<string> {
  let t = readToken();
  if (!t) throw new Error("Spotify isn't connected.");
  if (Date.now() > t.expiresAt) {
    try {
      t = await tokenRequest({ grant_type: "refresh_token", refresh_token: t.refresh });
      writeToken(t);
    } catch {
      writeToken(null);
      throw new Error("Your Spotify session expired. Connect again in Settings.");
    }
  }
  return t.access;
}

class SpotifyError extends Error {
  constructor(
    message: string,
    public status: number,
    public reason?: string,
  ) {
    super(message);
  }
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", ...init.headers },
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) writeToken(null);
    throw new SpotifyError(body?.error?.message || `Spotify error ${res.status}`, res.status, body?.error?.reason);
  }
  return body as T;
}

export async function getProfile() {
  return api<{ display_name: string; product: string }>("/me");
}

export async function getPlaylists(): Promise<SpotifyPlaylist[]> {
  const data = await api<{ items: ({ id: string; name: string; uri: string; images?: { url: string }[]; tracks?: { total: number }; items?: { total: number } } | null)[] }>("/me/playlists?limit=50");
  return (data?.items ?? [])
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({ id: p.id, name: p.name, uri: p.uri, image: p.images?.at(-1)?.url ?? p.images?.[0]?.url, tracks: p.tracks?.total ?? p.items?.total ?? 0 }));
}

export async function nowPlaying(): Promise<NowPlaying> {
  const p = await api<{ is_playing: boolean; item?: { name: string; artists?: { name: string }[]; album?: { images?: { url: string }[] } }; context?: { uri: string } }>("/me/player");
  if (!p) return { isPlaying: false };
  return {
    isPlaying: p.is_playing,
    track: p.item?.name,
    artist: p.item?.artists?.map((a) => a.name).join(", "),
    image: p.item?.album?.images?.at(-1)?.url,
    contextUri: p.context?.uri,
  };
}

/** Runs a playback command, waking up a Spotify device if none is active. */
async function control(path: string, method: "PUT" | "POST", body?: unknown) {
  try {
    await api(path, { method, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    if (e instanceof SpotifyError && e.status === 404) {
      const devices = await api<{ devices: { id: string; is_restricted: boolean }[] }>("/me/player/devices");
      const device = devices?.devices.find((d) => !d.is_restricted);
      if (!device) throw new Error("Open the Spotify app on this phone (play any song once), then try again.");
      await api(`${path}${path.includes("?") ? "&" : "?"}device_id=${device.id}`, { method, body: body ? JSON.stringify(body) : undefined });
      return;
    }
    if (e instanceof SpotifyError && e.status === 403) throw new Error("Controlling playback needs Spotify Premium. You can still play your playlist from the Spotify app.");
    throw e;
  }
}

export const play = (contextUri?: string) => control("/me/player/play", "PUT", contextUri ? { context_uri: contextUri } : undefined);
export const pause = () => control("/me/player/pause", "PUT");
export const next = () => control("/me/player/next", "POST");
export const previous = () => control("/me/player/previous", "POST");

/** Turns an open.spotify.com link into the embeddable player URL. */
export function parseSpotifyLink(link: string): { uri: string; embedUrl: string } | null {
  const m = link.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(playlist|album|artist|track|show)\/([A-Za-z0-9]+)/) ?? link.match(/spotify:(playlist|album|artist|track|show):([A-Za-z0-9]+)/);
  if (!m) return null;
  return { uri: `spotify:${m[1]}:${m[2]}`, embedUrl: `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0` };
}

export function embedUrlFor(uri: string): string | null {
  const m = uri.match(/^spotify:(\w+):(\w+)$/);
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0` : null;
}
