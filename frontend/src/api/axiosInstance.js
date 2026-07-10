const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL || "";
export const API_BASE_URL = configuredBaseUrl.replace(/\/api\/?$/, "").replace(/\/$/, "");
const ACCESS_TOKEN_KEY = "kaeve_access_token";
const REFRESH_TOKEN_KEY = "kaeve_refresh_token";
const USER_KEY = "kaeve_user";

let refreshingToken = null;

function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function setTokens(tokens) {
  if (tokens?.access) localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access);
  if (tokens?.refresh) localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
}

function getStoredUser() {
  const rawUser = localStorage.getItem(USER_KEY);
  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
}

function setStoredUser(user) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function refreshAccessToken() {
  if (!refreshingToken) {
    refreshingToken = fetch(`${API_BASE_URL}/api/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: getRefreshToken() }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to refresh session");
        const data = await response.json();
        setTokens(data);
        return data.access;
      })
      .finally(() => {
        refreshingToken = null;
      });
  }

  return refreshingToken;
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractErrorMessage(error, fallback) {
  if (!error) return fallback;
  if (typeof error === "string") return stripHtml(error) || fallback;
  if (Array.isArray(error)) return error.map((item) => extractErrorMessage(item, "")).filter(Boolean).join(" ");
  if (error.detail) return extractErrorMessage(error.detail, fallback);
  if (error.message) return extractErrorMessage(error.message, fallback);

  const fieldMessages = Object.entries(error)
    .map(([field, value]) => {
      const message = extractErrorMessage(value, "");
      return message ? `${field}: ${message}` : "";
    })
    .filter(Boolean);

  return fieldMessages.join(" ") || fallback;
}

async function request(path, options = {}, hasRetried = false) {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", headers.get("Content-Type") || "application/json");

  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    throw new Error(`Unable to reach backend at ${API_BASE_URL || "the configured API URL"}. Check that the Render backend service is running.`);
  }

  if (response.status === 401 && getRefreshToken() && !hasRetried) {
    try {
      const nextToken = await refreshAccessToken();
      headers.set("Authorization", `Bearer ${nextToken}`);
      return request(path, { ...options, headers }, true);
    } catch {
      clearTokens();
      window.location.hash = "#/login";
      throw new Error("Session expired");
    }
  }

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    const error = contentType.includes("application/json")
      ? await response.json().catch(() => ({}))
      : { detail: await response.text().catch(() => "") };
    const message = extractErrorMessage(error, `Request failed (${response.status})`);
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const tokenStorage = {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  USER_KEY,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  setTokens,
  setStoredUser,
  clearTokens,
};

export function authProviderUrl(provider, next = "/dashboard") {
  return `${API_BASE_URL}/api/auth/social/${provider}/start/?${new URLSearchParams({ next }).toString()}`;
}

export const apiClient = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: "DELETE" }),
};
