/**
 * Smoke test: every route module imports cleanly and exports a Route whose
 * shape matches its kind (page vs API). Catches regressions like missing
 * components, broken imports, or accidentally exporting `Route` as undefined.
 */
import { describe, it, expect, vi } from "vitest";

// Stub server-only and network-touching modules so importing route files
// (including their server fns) doesn't try to talk to Supabase/the network.
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          gt: () => ({ maybeSingle: () => ({ data: null }) }),
          maybeSingle: () => ({ data: null }),
        }),
      }),
    })),
  },
}));
vi.mock("@/lib/fetch-bill.server", () => ({
  fetchUSBillText: vi.fn(),
}));
vi.mock("@/lib/congress.server", () => ({}));

process.env.SUPABASE_URL = "http://localhost";
process.env.SUPABASE_PUBLISHABLE_KEY = "pk";
process.env.GEMINI_API_KEY = "test-key";

const PAGE_ROUTES = [
  "@/routes/__root",
  "@/routes/index",
  "@/routes/bill",
  "@/routes/b.$slug",
] as const;

const API_ROUTES = ["@/routes/api/explain-bill", "@/routes/api/public/resolve"] as const;

describe("route smoke test — page routes", () => {
  for (const id of PAGE_ROUTES) {
    it(`${id} exports a Route with a component`, async () => {
      const mod = await import(/* @vite-ignore */ id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const route: any = mod.Route;
      expect(route, `${id} must export Route`).toBeTruthy();
      expect(route.options, `${id} Route.options missing`).toBeTruthy();
      const hasComponent =
        typeof route.options.component === "function" ||
        typeof route.options.shellComponent === "function";
      expect(hasComponent, `${id} must define a component`).toBe(true);
    });
  }
});

describe("route smoke test — API routes", () => {
  for (const id of API_ROUTES) {
    it(`${id} exports an HTTP handler`, async () => {
      const mod = await import(/* @vite-ignore */ id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const route: any = mod.Route;
      expect(route, `${id} must export Route`).toBeTruthy();
      const handlers = route.options?.server?.handlers;
      expect(handlers, `${id} must define server.handlers`).toBeTruthy();
      const methods = Object.keys(handlers);
      expect(methods.length).toBeGreaterThan(0);
      for (const m of methods) {
        expect(typeof handlers[m]).toBe("function");
      }
    });
  }
});

describe("server functions module imports", () => {
  it("loads watchlist-free client modules without crashing", async () => {
    await expect(import("@/lib/watchlist")).resolves.toBeTruthy();
    await expect(import("@/lib/sanitize")).resolves.toBeTruthy();
    await expect(import("@/lib/url-allowlist")).resolves.toBeTruthy();
  });
});

describe("no auth-required UI surface", () => {
  it("does not ship /login or /account route files", async () => {
    // These were removed when the app went fully anonymous. A regression
    // re-adding them would silently bring back the sign-in gate.
    const fs = await import("node:fs/promises");
    for (const file of ["src/routes/login.tsx", "src/routes/account.tsx"]) {
      await expect(fs.stat(file)).rejects.toBeTruthy();
    }
  });

  it("the bill route source contains no sign-in / paywall copy", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/routes/bill.tsx", "utf8");
    expect(src).not.toMatch(/sign[\s-]?in/i);
    expect(src).not.toMatch(/log[\s-]?in/i);
    expect(src).not.toMatch(/paywall|upgrade|credits/i);
  });

  it("the index route source contains no sign-in / paywall copy", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/routes/index.tsx", "utf8");
    expect(src).not.toMatch(/sign[\s-]?in/i);
    expect(src).not.toMatch(/paywall|upgrade|credits/i);
  });
});

describe("no placeholder copy in shipped source", () => {
  it("src/routes contains no lorem/TODO/FIXME placeholders", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    async function walk(dir: string): Promise<string[]> {
      const out: string[] = [];
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...(await walk(p)));
        else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
      }
      return out;
    }
    const files = await walk("src/routes");
    const offenders: string[] = [];
    for (const f of files) {
      const src = await fs.readFile(f, "utf8");
      if (/\blorem ipsum\b/i.test(src)) offenders.push(`${f}: lorem ipsum`);
      if (/\bTODO\b/.test(src)) offenders.push(`${f}: TODO`);
      if (/\bFIXME\b/.test(src)) offenders.push(`${f}: FIXME`);
      if (/coming soon/i.test(src)) offenders.push(`${f}: coming soon`);
    }
    expect(offenders).toEqual([]);
  });
});
