import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://api-gateway:8001";

function buildBackendUrl(request: NextRequest, params: { path: string[] }): string {
  const path = params.path.join("/");
  const searchParams = request.nextUrl.searchParams.toString();
  return `${BACKEND_URL}/${path}${searchParams ? `?${searchParams}` : ""}`;
}

function forwardHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const authorization = request.headers.get("authorization");
  const accept = request.headers.get("accept");
  const cookie = request.headers.get("cookie") || "";
  
  // Try multiple ways to get the auth token
  let authTokenFromCookie = cookie.match(/(?:^|;\s*)auth_token=([^;]+)/)?.[1];
  
  // Fallback: use Next.js cookies API
  if (!authTokenFromCookie) {
    const nextCookie = request.cookies.get("auth_token");
    if (nextCookie?.value) {
      authTokenFromCookie = nextCookie.value;
    }
  }

  if (contentType) headers.set("content-type", contentType);
  if (authorization) {
    headers.set("authorization", authorization);
  } else if (authTokenFromCookie) {
    headers.set("authorization", `Bearer ${decodeURIComponent(authTokenFromCookie)}`);
  }
  if (accept) headers.set("accept", accept);
  if (cookie) headers.set("cookie", cookie);

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (origin) headers.set("origin", origin);
  if (referer) headers.set("referer", referer);
  if (host) headers.set("host", host);
  if (forwardedHost) headers.set("x-forwarded-host", forwardedHost);
  if (forwardedProto) headers.set("x-forwarded-proto", forwardedProto);

  return headers;
}

async function toClientResponse(response: Response): Promise<NextResponse> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  }

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: {
      "content-type": contentType || "text/plain; charset=utf-8",
    },
  });
}

async function proxy(request: NextRequest, params: { path: string[] }, method: string): Promise<NextResponse> {
  const url = buildBackendUrl(request, params);

  try {
    const body = method === "GET" || method === "DELETE" ? undefined : await request.text();
    const response = await fetch(url, {
      method,
      headers: forwardHeaders(request),
      body,
    });
    return toClientResponse(response);
  } catch (error) {
    console.error("API proxy error:", error);
    return NextResponse.json({ error: "Failed to fetch from backend" }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params, "GET");
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params, "POST");
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params, "PUT");
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params, "DELETE");
}
