import { NextRequest, NextResponse } from "next/server";

interface JwtPayload {
  sub?: string;
  username?: string;
  role?: string;
  exp?: number;
}

function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    );
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

const ADMIN_ROUTES = [
  "/admin/dashboard",
  "/admin/diagnostics",
  "/admin/history",
  "/admin/organizations",
  "/admin/tracking",
  "/admin",
];

const ANALYST_ROUTES = [
  "/insights/",
];

const USER_ROUTES = [
  "/user/exchange",
  "/user/history",
  "/user/dashboard",
  "/user/transactions",
  "/user/wallet",
  "/user/profile",
  "/user/batch",
  "/user/api",
];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get("auth_token")?.value;

  const isProtectedRoute = USER_ROUTES.some(route => pathname.startsWith(route));
  const isAdminRoute = ADMIN_ROUTES.some(route => pathname.startsWith(route));
  const isAnalystRoute = ANALYST_ROUTES.some(route => pathname.startsWith(route));

  if (isProtectedRoute || isAdminRoute || isAnalystRoute) {
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const payload = decodeJwt(token);
    if (!payload || !payload.role) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const role = payload.role;

    if (isAdminRoute && role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (isAnalystRoute && role !== "admin" && role !== "analyst") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
