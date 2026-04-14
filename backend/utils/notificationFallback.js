function shouldUseFallback() {
  return String(process.env.NOTIFICATION_FALLBACK_ENABLED || "").toLowerCase() === "true";
}

async function sendFallbackNotification(notification) {
  if (!shouldUseFallback()) {
    return;
  }

  const mode = String(process.env.NOTIFICATION_FALLBACK_MODE || "log").toLowerCase();
  const message = `[NotificationFallback:${mode}] user=${notification.userId} type=${notification.type} title="${notification.title}"`;

  // Demo-safe fallback. Swap this with real SMTP/SMS provider when needed.
  // Keeping this lightweight avoids extra infra for your current project scope.
  console.log(message);
}

module.exports = {
  sendFallbackNotification
};
