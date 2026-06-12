/**
 * Authenticated fetch wrapper.
 * Automatically includes the JWT token from localStorage in the Authorization header.
 * Required because Next.js rewrites proxy directly to the API gateway,
 * bypassing the API route handler that would extract cookies.
 */
export function authFetch(url: string | URL | Request, options?: RequestInit): Promise<Response> {
  const headers = new Headers(options?.headers);
  if (typeof window !== "undefined" && !headers.has("Authorization")) {
    const token = localStorage.getItem("auth_token");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  return fetch(url, { cache: "no-store", ...options, headers });
}
