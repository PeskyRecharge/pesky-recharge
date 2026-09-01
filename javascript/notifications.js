const notificationStorageKey = (userId, type) => `pesky-notifications-${userId}-${type}`;

function safeLocalStorageGet(key) {
  try {
    return window.localStorage ? window.localStorage.getItem(key) : null;
  } catch (error) {
    console.warn("Local storage unavailable:", error);
    return null;
  }
}

function safeLocalStorageSet(key, value) {
  try {
    if (!window.localStorage) return;
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn("Local storage unavailable:", error);
  }
}

function safeLocalStorageRemove(key) {
  try {
    if (!window.localStorage) return;
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn("Local storage unavailable:", error);
  }
}

function notificationsEnabled(userId, type) {
  return safeLocalStorageGet(notificationStorageKey(userId, type)) === "enabled";
}

function setNotificationsEnabled(userId, type, enabled) {
  const key = notificationStorageKey(userId, type);
  if (enabled) safeLocalStorageSet(key, "enabled");
  else safeLocalStorageRemove(key);
}

function showAccountNotification(title, options) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  try {
    new Notification(title, options);
  } catch (error) {
    console.warn("Notification failed:", error);
  }
}