/**
 * Browser Push Notification helper
 * Shows native OS notifications when events happen
 * Works even when tab is in background
 */

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getPushPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestPushPermission(): Promise<boolean> {
  if (!isPushSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function showPushNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    tag?: string;
    onClick?: () => void;
  }
) {
  if (!isPushSupported() || Notification.permission !== "granted") return;

  const notification = new Notification(title, {
    body: options?.body,
    icon: options?.icon || "/icon-192.png",
    tag: options?.tag,
    badge: "/icon-192.png",
  });

  if (options?.onClick) {
    notification.onclick = () => {
      window.focus();
      options.onClick?.();
      notification.close();
    };
  }

  // Auto close after 5 seconds
  setTimeout(() => notification.close(), 5000);
}
