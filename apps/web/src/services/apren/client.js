function authHeaders() {
  try {
    const token = window.sessionStorage.getItem("seven_access_token") || "";
    return token ? { authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function apiGet(url) {
  const response = await fetch(url, { headers: authHeaders() });

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${url}`);
  }

  return response.json();
}
