export function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function decodeJwt(token) {
  if (!token) return null;

  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(window.atob(normalized));
  } catch {
    return null;
  }
}

export function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

export function getResults(response) {
  if (Array.isArray(response)) return response;
  return response?.results || [];
}

export function getCount(response) {
  if (Array.isArray(response)) return response.length;
  return response?.count || getResults(response).length;
}

export function toQueryString(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "All") {
      searchParams.set(key, value);
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}
