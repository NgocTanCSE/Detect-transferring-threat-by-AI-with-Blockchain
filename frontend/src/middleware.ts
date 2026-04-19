import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get("auth_token")?.value;

  // Routes that require authentication
  const adminRoutes = ["/admin/dashboard", "/admin/logs", "/admin/tracking", "/admin/history"];
  const protectedRoutes = ["/user/exchange", "/user/history"];

  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route));
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const needsAuth = isAdminRoute || isProtectedRoute;

  // If accessing protected route without token, redirect to login
  if (needsAuth && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
