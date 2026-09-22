import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { updateSession } from "@/lib/supabase/proxy";

vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig: vi.fn() }));

const getClaims = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSupabaseConfig).mockReturnValue({
    url: "https://project.supabase.co",
    publishableKey: "test-public-key",
  });
  getClaims.mockResolvedValue({ data: { claims: null }, error: null });
  vi.mocked(createServerClient).mockReturnValue({ auth: { getClaims } } as unknown as ReturnType<typeof createServerClient>);
});

describe("public pages without a Supabase dependency", () => {
  it.each([
    "/", "/rechner", "/demo", "/demo/portfolio", "/impressum",
    "/datenschutz", "/nutzungsbedingungen", "/robots.txt", "/sitemap.xml",
  ])("serves %s without configuration or a network auth call", async (path) => {
    vi.mocked(getSupabaseConfig).mockImplementation(() => { throw new Error("Not configured"); });
    const response = await updateSession(new NextRequest(`https://estatebrain.test${path}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(getSupabaseConfig).not.toHaveBeenCalled();
    expect(createServerClient).not.toHaveBeenCalled();
    expect(getClaims).not.toHaveBeenCalled();
  });
});

describe("account routes keep their session protection", () => {
  it.each(["/app", "/app/steuervergleich", "/portal", "/onboarding", "/konto/einstellungen"])("redirects signed-out requests for %s", async (path) => {
    const response = await updateSession(new NextRequest(`https://estatebrain.test${path}?from=test`));
    const location = new URL(response.headers.get("location")!);
    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe(`${path}?from=test`);
    expect(getClaims).toHaveBeenCalledOnce();
  });

  it("does not silently allow protected pages when configuration is missing", async () => {
    vi.mocked(getSupabaseConfig).mockImplementation(() => { throw new Error("Not configured"); });
    await expect(updateSession(new NextRequest("https://estatebrain.test/app"))).rejects.toThrow("Not configured");
  });

  it("allows authenticated account access and retains the login redirect", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-id" } }, error: null });
    const account = await updateSession(new NextRequest("https://estatebrain.test/app"));
    expect(account.status).toBe(200);
    const login = await updateSession(new NextRequest("https://estatebrain.test/login"));
    expect(login.headers.get("location")).toBe("https://estatebrain.test/app");
  });

  it.each(["/einladung/token", "/passwort-zuruecksetzen", "/auth/callback", "/api/search"])("still refreshes sessions for %s", async (path) => {
    await updateSession(new NextRequest(`https://estatebrain.test${path}`));
    expect(getClaims).toHaveBeenCalledOnce();
  });
});
