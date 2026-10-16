// The notification service has no API endpoint yet. Port 4007 is hospitality,
// so return the expected empty shape rather than calling an unrelated service.
export async function getNotifications(_userId = 1) {
  return { notifications: [] };
}
