import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { LocalNotifications } from "@capacitor/local-notifications";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { StatusBar, Style } from "@capacitor/status-bar";

/** True inside the iOS app (Capacitor), false in a browser. */
export const isNative = Capacitor.isNativePlatform();

export const haptic = {
  light: () => isNative && void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}),
  medium: () => isNative && void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {}),
  success: () => isNative && void Haptics.notification({ type: NotificationType.Success }).catch(() => {}),
};

export async function keepAwake(on: boolean) {
  if (!isNative) return false;
  try {
    await (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep());
  } catch {
    // Not fatal.
  }
  return true;
}

const REST_NOTIFICATION_ID = 4201;
let permission: boolean | null = null;

async function canNotify(): Promise<boolean> {
  if (!isNative) return false;
  if (permission !== null) return permission;
  try {
    const cur = await LocalNotifications.checkPermissions();
    permission = cur.display === "granted" || (await LocalNotifications.requestPermissions()).display === "granted";
  } catch {
    permission = false;
  }
  return permission;
}

/** Notifies when the rest timer ends, so it still works with the phone locked or the app in the background. */
export async function scheduleRestDone(at: number, body: string) {
  if (!(await canNotify())) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
    if (at - Date.now() < 1500) return;
    await LocalNotifications.schedule({
      notifications: [{ id: REST_NOTIFICATION_ID, title: "Rest's over 💪", body, schedule: { at: new Date(at), allowWhileIdle: true } }],
    });
  } catch {
    // Ignore; the in-app timer still works.
  }
}

export async function cancelRestDone() {
  if (!isNative) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
  } catch {
    // Ignore.
  }
}

/** Ask for notification permission ahead of the first rest timer. */
export const prepareNotifications = () => void canNotify();

export function setStatusBar(dark: boolean) {
  if (!isNative) return;
  void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
}
