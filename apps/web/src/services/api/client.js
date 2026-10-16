function getStoredAccessToken() {
  try {
    return window.sessionStorage.getItem("seven_access_token") || "";
  } catch {
    return "";
  }
}

function clearRejectedSession() {
  try {
    window.sessionStorage.removeItem("seven_access_token");
    window.sessionStorage.removeItem("seven_user");
    window.dispatchEvent(new Event("apren:auth-changed"));
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
}

export async function apiRequest(url, options = {}) {
  try {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };
    const token = getStoredAccessToken();

    if (token && !headers.authorization && !headers.Authorization) {
      headers.authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      let detail = "";
      try {
        const body = await response.clone().json();
        detail = body?.error ? `: ${body.error}` : "";
      } catch {
        // Keep the HTTP status useful even when the server returns non-JSON.
      }

      if (response.status === 401 && token) {
        clearRejectedSession();
      }
      throw new Error(`API error ${response.status}${detail}`);
    }

    return await response.json();
  } catch (error) {
    console.error("āprən API error:", error);
    return null;
  }
}
