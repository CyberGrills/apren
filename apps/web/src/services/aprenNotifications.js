
// Notifications do not have a dedicated API service yet. Port 4007 belongs
// to the hospitality service, so do not send notification requests there.
// Keep the UI contract stable until a real notification endpoint is added.
export async function getNotifications(_userId = 1) {
  return { notifications: [] };
}

