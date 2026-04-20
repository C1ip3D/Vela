import { Expo, ExpoPushMessage } from "expo-server-sdk";

const expo = new Expo();

export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!Expo.isExpoPushToken(expoPushToken)) {
    console.warn(`[Push] Invalid Expo push token: ${expoPushToken}`);
    return;
  }

  const message: ExpoPushMessage = { to: expoPushToken, title, body, data };

  try {
    const [ticket] = await expo.sendPushNotificationsAsync([message]);
    if (ticket.status === "error") {
      console.error(`[Push] Ticket error: ${ticket.message}`);
    }
  } catch (e) {
    console.error("[Push] Failed to send notification:", e);
  }
}
