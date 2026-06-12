import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get("auth_token")?.value;

  // Protect all user routes
  const protectedRoutes = [
    "/user/exchange",
    "/user/history",
    "/user/dashboard",
    "/user/transactions",
    "/user/wallet",
    "/user/profile",
    "/user/batch",
    "/user/api",
  ];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  // Protect all admin routes
  const adminRoutes = [
    "/admin/dashboard",
    "/admin/diagnostics",
    "/admin/history",
    "/admin/organizations",
    "/admin/tracking",
  ];
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route));

  // Protect insight routes
  const insightRoutes = ["/insights/"];
  const isInsightRoute = insightRoutes.some(route => pathname.startsWith(route));

  // If accessing protected route without token, redirect to login
  if ((isProtectedRoute || isAdminRoute || isInsightRoute) && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
