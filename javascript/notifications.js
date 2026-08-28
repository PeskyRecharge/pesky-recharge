const notificationStorageKey = (userId, type) => `pesky-notifications-${userId}-${type}`;

function notificationsEnabled(userId, type) {
  return localStorage.getItem(notificationStorageKey(userId, type)) === "enabled";
}

function setNotificationsEnabled(userId, type, enabled) {
  const key = notificationStorageKey(userId, type);
  if (enabled) localStorage.setItem(key, "enabled");
  else localStorage.removeItem(key);
}

function showAccountNotification(title, options) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  new Notification(title, options);
}