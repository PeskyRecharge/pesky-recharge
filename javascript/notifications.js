const VAPID_PUBLIC_KEY = "BMP80kqV4dMRXB1ynKa3GVvLY7OadQu6aNwlud0K5hB4mrEMptKgd02jVpAZBY2lJw_tSPV7ozE2cylDX0tSYhk";
const notificationPreferencesKey = userId => `pesky-notification-preferences-${userId}`;

function readNotificationPreferences(userId) {
  try {
    return JSON.parse(localStorage.getItem(notificationPreferencesKey(userId)) || "{}");
  } catch {
    return {};
  }
}

window.notificationPreferenceEnabled = (userId, type) => readNotificationPreferences(userId)[type] === true;
window.notificationPreferenceIsSet = (userId, type) =>
  Object.prototype.hasOwnProperty.call(readNotificationPreferences(userId), type);
window.notificationsEnabled = (userId, type) => {
  const preferences = readNotificationPreferences(userId);
  return preferences.push === true && preferences[type] === true;
};
window.setNotificationsEnabled = (userId, type, enabled) => {
  const preferences = readNotificationPreferences(userId);
  preferences[type] = enabled;
  localStorage.setItem(notificationPreferencesKey(userId), JSON.stringify(preferences));
};

function decodeVapidPublicKey(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function subscribeDeviceToPush(supabaseClient, userId) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push notifications are not supported by this browser.");
  }

  await navigator.serviceWorker.register("/sw.js");
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription() ||
    await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeVapidPublicKey(VAPID_PUBLIC_KEY),
    });
  const serialized = subscription.toJSON();

  if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys?.auth) {
    throw new Error("The browser returned an incomplete push subscription.");
  }

  const { error } = await supabaseClient.from("push_subscriptions").upsert({
    user_id: userId,
    endpoint: serialized.endpoint,
    p256dh: serialized.keys.p256dh,
    auth: serialized.keys.auth,
  }, { onConflict: "endpoint" });

  if (error) throw error;
}

async function unsubscribeDeviceFromPush(supabaseClient) {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const { error } = await supabaseClient
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", subscription.endpoint);
  if (error) throw error;

  await subscription.unsubscribe();
}

window.PeskyNotifications = {
  subscribeDeviceToPush,
  unsubscribeDeviceFromPush,
  showAccountNotification: async (title, options = {}) => {
    if (Notification.permission !== "granted" || !("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      icon: "/img/pesky4.png",
      body: options.body || "",
      data: { url: "/notification-center.html" },
      ...options,
    });
  },
};

window.showAccountNotification = window.PeskyNotifications.showAccountNotification;