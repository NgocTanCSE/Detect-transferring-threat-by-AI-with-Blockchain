import { NextRequest, NextResponse } from "next/server";

function decodeJwt(token: string) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get("auth_token")?.value;

  // Admin routes are open to everyone without login, BUT blocked for logged-in Users.
  const protectedRoutes = ["/user/exchange", "/user/history"];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const needsAuth = isProtectedRoute;

  // If accessing protected route without token, redirect to login
  if (needsAuth && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (token) {
    const payload = decodeJwt(token);
    // If the user has a 'user' role, they cannot access the root or admin paths
    if (payload && payload.role === "user") {
      if (pathname === "/" || pathname.startsWith("/admin")) {
        return NextResponse.redirect(new URL("/user/exchange", request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
