import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

const protectedPrefixes = ["/app", "/portal", "/onboarding", "/konto"];
const authPrefixes = [
  "/login",
  "/registrieren",
  "/passwort-vergessen",
];

const publicPaths = new Set([
  "/",
  "/rechner",
  "/demo",
  "/impressum",
  "/datenschutz",
  "/nutzungsbedingungen",
  "/robots.txt",
  "/sitemap.xml",
]);

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // Marketing, the portfolio demo and the legacy calculator redirect do not
  // need a Supabase session. Authenticated dashboards stay protected below.
  if (publicPaths.has(path) || path.startsWith("/demo/")) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseConfig();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);
  const isProtected = protectedPrefixes.some((prefix) =>
    path.startsWith(prefix),
  );
  const isAuthPage = authPrefixes.some((prefix) => path.startsWith(prefix));

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${path}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && isAuthPage) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return response;
}
