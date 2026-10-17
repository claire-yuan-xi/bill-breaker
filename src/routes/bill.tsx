import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getBillMeta, type BillMeta } from "@/lib/bill.functions";
import { createShare } from "@/lib/user.functions";
import { SafeExternalLink } from "@/lib/safe-link";
import { SaveBillToggle } from "@/components/saved/SaveBillToggle";

import { readProfile, clearProfile, type ReaderProfile } from "@/lib/reader-profile";
import { formatRelative, cachedBadgeText } from "@/lib/cached-badge";
void formatRelative;
void cachedBadgeText;

type Search = {
  state?: string;
  number?: string;
  text?: string;
};

type Supporter = { point: string; who: string };
type SupportersCritics = { supporters: Supporter[]; critics: Supporter[] };
type StatusQuoChange = { today: string; after: string; magnitude: "minor" | "moderate" | "major" };
type StatusQuoDiff = { changes: StatusQuoChange[] };
type PersonalImpact = {
  verdict: "positive" | "negative" | "mixed" | "neutral";
  headline: string;
  reasons: string[];
  confidence: "low" | "medium" | "high";
};

export const Route = createFileRoute("/bill")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    state: typeof s.state === "string" ? s.state : "US",
    number: typeof s.number === "string" ? s.number : "",
    text: typeof s.text === "string" ? s.text : "",
  }),
  component: BillPage,
  head: () => ({
    meta: [
      { title: "BillBreaker — Bill breakdown" },
      {
        name: "description",
        content:
          "Read a plain-English bill summary, compare current law, and explore supporters and critics.",
      },
      { property: "og:title", content: "BillBreaker — Bill breakdown" },
      {
        property: "og:description",
        content: "Plain-English bill summaries, current-law comparisons, and legislative impact.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const RECENT_KEY = "bb_recent_v1";
type RecentItem = { state: string; number: string; title: string; ts: number };

function saveRecent(item: RecentItem) {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list: RecentItem[] = raw ? JSON.parse(raw) : [];
    const dedup = list.filter((x) => !(x.state === item.state && x.number === item.number));
    dedup.unshift(item);
    localStorage.setItem(RECENT_KEY, JSON.stringify(dedup.slice(0, 8)));
  } catch {
    /* ignore */
  }
}

type QuickTake = {
  tldr: string;
  controversy_score: number;
  controversy_reason: string;
  dollar_impact: string;
  timeline: string;
};
type WinnersLosers = {
  winners: { group: string; why: string }[];
  losers: { group: string; why: string }[];
};
type Citation = { quote: string; section: string; why_matters: string };

type AIState = {
  status: string | null;
  title: string | null;
  sourceUrl: string | null;
  source: string | null;
  triedSources: string[] | null;
  cached: boolean;
  cachedAt: string | null;
  cachedReason: string | null;
  quick: QuickTake | null;
  wl: WinnersLosers | null;
  citations: Citation[] | null;
  sc: SupportersCritics | null;
  sq: StatusQuoDiff | null;
  personal: PersonalImpact | null;
  error: string | null;
  done: boolean;
};

const initialAI: AIState = {
  status: null,
  title: null,
  sourceUrl: null,
  source: null,
  triedSources: null,
  cached: false,
  cachedAt: null,
  cachedReason: null,
  quick: null,
  wl: null,
  citations: null,
  sc: null,
  sq: null,
  personal: null,
  error: null,
  done: false,
};

function BillPage() {
  const { state = "US", number = "", text = "" } = Route.useSearch();
  const navigate = useNavigate();
  const fetchMeta = useServerFn(getBillMeta);

  const metaQ = useQuery({
    queryKey: ["bill-meta", state, number, text.length > 0],
    queryFn: () =>
      fetchMeta({ data: { state, billNo: number, hasText: text.trim().length >= 200 } }),
  });

  const [ai, setAi] = useState<AIState>(initialAI);
  const aiStarted = useRef(false);

  useEffect(() => {
    if (aiStarted.current) return;
    if (!number && text.trim().length < 200) return;
    aiStarted.current = true;
    streamAI({
      state,
      billNo: number,
      text,
      onUpdate: setAi,
    });
  }, [state, number, text]);

  // Persist title to recents once we know it.
  useEffect(() => {
    if (number && ai.title) {
      saveRecent({ state, number, title: ai.title, ts: Date.now() });
    }
  }, [state, number, ai.title]);

  const title = ai.title || metaQ.data?.id || `${state} ${number}` || "Bill";

  return (
    <main className="min-h-screen" style={{ background: "#faf8f3", color: "#1a1a1a" }}>
      <header className="border-b" style={{ borderColor: "#d6d3ca" }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
          <Link
            to="/"
            className="flex items-baseline gap-2"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            <span className="text-2xl">Bill Breaker</span>
            <span className="text-xs" style={{ color: "#7a766c" }}>
              vol. I
            </span>
          </Link>
          <button
            onClick={() => navigate({ to: "/" })}
            className="text-xs underline-offset-4 hover:underline"
            style={{ fontFamily: "'Fraunces', serif", color: "#3a3a3a" }}
          >
            ← Return to index
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-16">
        {metaQ.isError && (
          <div
            className="border-t border-b py-6 text-sm"
            style={{
              borderColor: "#c4413a",
              color: "#c4413a",
              fontFamily: "'Fraunces', serif",
            }}
          >
            Could not load this bill.{" "}
            <button className="underline" onClick={() => metaQ.refetch()}>
              Try again.
            </button>
          </div>
        )}
        {(metaQ.data || ai.title) && (
          <Header
            title={title}
            jurisdiction={state}
            id={metaQ.data?.id || `${state} ${number}`.trim() || "pasted bill"}
            sourceUrl={ai.sourceUrl || metaQ.data?.sourceUrl || ""}
            billNo={number}
            state={state}
            ai={ai}
          />
        )}
        <ReaderStrip />
        {metaQ.data?.notice && !ai.quick && (
          <div
            className="mt-10 border-t border-b py-5 text-base leading-relaxed"
            style={{
              fontFamily: "'Fraunces', serif",
              borderColor: "#d6d3ca",
              color: "#3a3a3a",
            }}
          >
            {metaQ.data.notice}
          </div>
        )}
        <AISection ai={ai} state={state} billNo={number} />
      </div>
    </main>
  );
}

function Header({
  title,
  jurisdiction,
  id,
  sourceUrl,
  billNo,
  state,
  ai,
}: {
  title: string;
  jurisdiction: string;
  id: string;
  sourceUrl: string;
  billNo: string;
  state: string;
  ai: AIState;
}) {
  const serif = { fontFamily: "'Fraunces', serif" };
  const badge = ai.cached ? cachedBadgeText(ai.cachedReason, ai.cachedAt) : null;
  const sourceLabels: Record<string, string> = {
    "congress.gov": "Congress.gov",
    govinfo: "GovInfo",
    openstates: "OpenStates",
  };
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.25em]" style={{ color: "#7a766c" }}>
        {jurisdiction === "US" ? "United States Federal" : jurisdiction} · No. {id}
        {badge && (
          <span className="ml-3" style={{ ...serif, color: "#3a7a4a" }}>
            · {badge.label}
          </span>
        )}
      </div>
      {badge?.action && (
        <div
          className="mt-3 flex flex-wrap items-center gap-3 border-l-2 pl-3 py-2 text-xs"
          style={{ ...serif, color: "#5a5650", borderColor: "#3a7a4a", background: "#f3efe4" }}
          role="status"
        >
          <span>{badge.action}</span>
          <button
            onClick={() => window.location.reload()}
            className="underline underline-offset-4 hover:text-foreground"
            style={{ color: "#3a3a3a" }}
          >
            Retry now
          </button>
        </div>
      )}
      <h1 className="mt-5 text-5xl leading-[1.05] md:text-6xl" style={serif}>
        {title}
      </h1>
      <div
        className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs"
        style={{ ...serif, color: "#3a3a3a" }}
      >
        {sourceUrl && (
          <SafeExternalLink
            href={sourceUrl}
            className="underline underline-offset-4"
            fallbackText="Official source unavailable"
          >
            Open official source ↗
          </SafeExternalLink>
        )}
        <ShareButton shareable={Boolean(billNo)} />
        {billNo && <SaveBillToggle state={state} billNo={billNo} title={title} />}
        {billNo && ai.done && !ai.error && (
          <PublishShare state={state} billNo={billNo} title={title} sourceUrl={sourceUrl} ai={ai} />
        )}
      </div>
      {(ai.source || (ai.triedSources && ai.triedSources.length > 0)) && (
        <div className="mt-3 text-[10px] uppercase tracking-[0.25em]" style={{ color: "#7a766c" }}>
          {ai.source && <>Bill text via {sourceLabels[ai.source] ?? ai.source}</>}
          {ai.triedSources && ai.triedSources.length > 1 && (
            <span className="ml-2 normal-case tracking-normal" style={serif}>
              (tried: {ai.triedSources.map((s) => sourceLabels[s] ?? s).join(" → ")})
            </span>
          )}
        </div>
      )}
    </div>
  );
}

async function streamAI({
  state,
  billNo,
  text,
  onUpdate,
}: {
  state: string;
  billNo: string;
  text: string;
  onUpdate: (updater: (prev: AIState) => AIState) => void;
}) {
  const apply = (ev: string, payload: Record<string, unknown>) => {
    onUpdate((p) => {
      switch (ev) {
        case "status":
          return { ...p, status: String(payload.message || "") };
        case "meta":
          return {
            ...p,
            title: typeof payload.title === "string" ? payload.title : p.title,
            sourceUrl: typeof payload.sourceUrl === "string" ? payload.sourceUrl : p.sourceUrl,
            source: typeof payload.source === "string" ? payload.source : p.source,
            triedSources: Array.isArray(payload.tried)
              ? (payload.tried as string[])
              : p.triedSources,
            cached: Boolean(payload.cached),
            cachedAt: typeof payload.cached_at === "string" ? payload.cached_at : p.cachedAt,
            cachedReason:
              typeof payload.cached_reason === "string" ? payload.cached_reason : p.cachedReason,
          };
        case "quick_take":
          return { ...p, quick: payload as unknown as QuickTake, status: null };
        case "winners_losers":
          return { ...p, wl: payload as unknown as WinnersLosers };
        case "citations":
          return { ...p, citations: (payload as { citations: Citation[] }).citations };
        case "supporters_vs_critics":
          return { ...p, sc: payload as unknown as SupportersCritics };
        case "status_quo_diff":
          return { ...p, sq: payload as unknown as StatusQuoDiff };
        case "personal_impact":
          return { ...p, personal: payload as unknown as PersonalImpact };
        case "error":
          return { ...p, error: String(payload.message || "AI error"), done: true, status: null };
        case "done":
          return { ...p, done: true, status: null };
        default:
          return p;
      }
    });
  };

  /** Single non-streamed JSON call — used as a graceful fallback. */
  async function runJsonFallback(reason: string) {
    onUpdate((p) => ({ ...p, status: "Retrying without streaming…", error: null, done: false }));
    try {
      const res = await fetch("/api/explain-bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, billNo, text, mode: "json" }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        onUpdate((p) => ({
          ...p,
          error: msg || `Analysis failed (${res.status}). ${reason}`,
          done: true,
          status: null,
        }));
        return;
      }
      const payload = (await res.json()) as Record<string, unknown>;
      apply("meta", {
        title: payload.title,
        sourceUrl: payload.sourceUrl,
        source: payload.source,
        tried: payload.tried,
        cached: payload.cached,
        cached_at: payload.cached_at,
        cached_reason: payload.cached_reason,
      });
      for (const key of [
        "quick_take",
        "winners_losers",
        "citations",
        "supporters_vs_critics",
        "status_quo_diff",
      ]) {
        if (payload[key]) apply(key, payload[key] as Record<string, unknown>);
      }
      apply("done", {});
    } catch (e) {
      onUpdate((p) => ({
        ...p,
        error: e instanceof Error ? e.message : reason,
        done: true,
        status: null,
      }));
    }
  }

  // Some environments (corporate proxies, certain browsers) buffer SSE so badly
  // it never arrives. If we haven't received a single event in 25s, abort and
  // fall back to JSON mode.
  const ctrl = new AbortController();
  let gotAnyEvent = false;
  const stall = setTimeout(() => {
    if (!gotAnyEvent) ctrl.abort();
  }, 25_000);

  try {
    const res = await fetch("/api/explain-bill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, billNo, text }),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) {
      clearTimeout(stall);
      await runJsonFallback(`HTTP ${res.status}`);
      return;
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let currentEvent = "";
    let sawFallbackHint = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).replace(/\r$/, "");
        buf = buf.slice(nl + 1);
        if (line === "") {
          currentEvent = "";
          continue;
        }
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          const raw = line.slice(6);
          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(raw);
          } catch {
            continue;
          }
          gotAnyEvent = true;
          if (currentEvent === "error" && payload.fallback === "json") {
            sawFallbackHint = true;
            break;
          }
          apply(currentEvent, payload);
        }
      }
      if (sawFallbackHint) break;
    }
    clearTimeout(stall);
    if (sawFallbackHint) await runJsonFallback("retrying");
  } catch (e) {
    clearTimeout(stall);
    const reason = e instanceof Error ? e.message : "Network error";
    // If we never got a real event, try the JSON fallback once.
    if (!gotAnyEvent) {
      await runJsonFallback(reason);
    } else {
      onUpdate((p) => ({ ...p, error: reason, done: true }));
    }
  }
}

function ShareButton({ shareable }: { shareable: boolean }) {
  const [copied, setCopied] = useState(false);
  if (!shareable) return null;
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }
  return (
    <button
      onClick={copy}
      className="text-xs underline-offset-4 hover:underline"
      style={{ fontFamily: "'Fraunces', serif", color: "#3a3a3a" }}
    >
      {copied ? "Link copied." : "Share this link"}
    </button>
  );
}

function AISection({ ai }: { ai: AIState; state: string; billNo: string }) {
  const serif = { fontFamily: "'Fraunces', serif" };
  const showing = ai.quick || ai.wl || ai.citations || ai.status || ai.error;
  if (!showing) return null;

  return (
    <div className="mt-16 border-t pt-10" style={{ borderColor: "#d6d3ca" }}>
      <div className="text-[11px] uppercase tracking-[0.25em]" style={{ color: "#7a766c" }}>
        AI breakdown
      </div>
      <h2 className="mt-2 text-4xl" style={serif}>
        The plain-English read
      </h2>

      {ai.status && (
        <div
          className="mt-6 flex items-center gap-3 text-sm"
          style={{ ...serif, color: "#7a766c" }}
        >
          <span
            className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
            style={{ background: "#7a766c" }}
          />
          {ai.status}
        </div>
      )}
      {ai.error && (
        <div
          className="mt-6 border-t border-b py-4 text-sm"
          style={{ ...serif, color: "#c4413a", borderColor: "#c4413a" }}
        >
          {ai.error}
        </div>
      )}

      {ai.personal && <PersonalImpactBlock pi={ai.personal} />}
      {ai.quick && <QuickTakeBlock q={ai.quick} />}
      {ai.sq && <StatusQuoBlock sq={ai.sq} />}
      {ai.wl && <WinnersLosersBlock wl={ai.wl} />}
      {ai.sc && <SupportersCriticsBlock sc={ai.sc} />}
      {ai.citations && <CitationsBlock cits={ai.citations} />}
    </div>
  );
}

function PersonalImpactBlock({ pi }: { pi: PersonalImpact }) {
  const serif = { fontFamily: "'Fraunces', serif" };
  const tone =
    pi.verdict === "positive"
      ? "#3a7a4a"
      : pi.verdict === "negative"
        ? "#a04438"
        : pi.verdict === "mixed"
          ? "#a07a38"
          : "#5a5650";
  return (
    <div className="mt-8 border-l-2 pl-5" style={{ borderColor: tone }}>
      <div className="text-[10px] uppercase tracking-[0.25em]" style={{ color: tone }}>
        How this affects you · {pi.verdict} · confidence: {pi.confidence}
      </div>
      <p className="mt-2 text-2xl leading-[1.4]" style={serif}>
        {pi.headline}
      </p>
      <ul className="mt-4 space-y-2">
        {pi.reasons.map((r, i) => (
          <li key={i} className="text-base leading-[1.6]" style={{ ...serif, color: "#3a3a3a" }}>
            · {r}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusQuoBlock({ sq }: { sq: StatusQuoDiff }) {
  const serif = { fontFamily: "'Fraunces', serif" };
  if (!sq.changes?.length) return null;
  return (
    <div className="mt-12">
      <div className="text-[11px] uppercase tracking-[0.25em]" style={{ color: "#7a766c" }}>
        Compared to current law
      </div>
      <ul className="mt-4 space-y-6">
        {sq.changes.map((c, i) => (
          <li
            key={i}
            className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2"
            style={{ borderColor: "#d6d3ca" }}
          >
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "#7a766c" }}>
                Today
              </div>
              <div className="mt-1 text-base leading-[1.6]" style={{ ...serif, color: "#3a3a3a" }}>
                {c.today}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "#3a3a3a" }}>
                If passed · {c.magnitude}
              </div>
              <div className="mt-1 text-base leading-[1.6]" style={serif}>
                {c.after}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SupportersCriticsBlock({ sc }: { sc: SupportersCritics }) {
  const serif = { fontFamily: "'Fraunces', serif" };
  return (
    <div className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-2">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em]" style={{ color: "#3a3a3a" }}>
          What supporters say
        </div>
        <ul className="mt-4 space-y-5">
          {sc.supporters.map((s, i) => (
            <li key={i} className="border-t pt-3" style={{ borderColor: "#d6d3ca" }}>
              <div className="text-base leading-[1.6]" style={serif}>
                {s.point}
              </div>
              <div className="mt-1 text-xs" style={{ ...serif, color: "#7a766c" }}>
                — {s.who}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em]" style={{ color: "#3a3a3a" }}>
          What critics say
        </div>
        <ul className="mt-4 space-y-5">
          {sc.critics.map((s, i) => (
            <li key={i} className="border-t pt-3" style={{ borderColor: "#d6d3ca" }}>
              <div className="text-base leading-[1.6]" style={serif}>
                {s.point}
              </div>
              <div className="mt-1 text-xs" style={{ ...serif, color: "#7a766c" }}>
                — {s.who}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function QuickTakeBlock({ q }: { q: QuickTake }) {
  const serif = { fontFamily: "'Fraunces', serif" };
  return (
    <div className="mt-8">
      <p className="text-2xl leading-[1.4]" style={serif}>
        {q.tldr}
      </p>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Stat label="Controversy" value={`${q.controversy_score}/10`} sub={q.controversy_reason} />
        <Stat label="Dollar impact" value={q.dollar_impact} />
        <Stat label="Timeline" value={q.timeline} />
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const serif = { fontFamily: "'Fraunces', serif" };
  return (
    <div className="border-t pt-4" style={{ borderColor: "#d6d3ca" }}>
      <div className="text-[10px] uppercase tracking-[0.25em]" style={{ color: "#7a766c" }}>
        {label}
      </div>
      <div className="mt-2 text-xl leading-snug" style={serif}>
        {value}
      </div>
      {sub && (
        <div className="mt-2 text-xs leading-relaxed" style={{ ...serif, color: "#5a5650" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function WinnersLosersBlock({ wl }: { wl: WinnersLosers }) {
  const serif = { fontFamily: "'Fraunces', serif" };
  return (
    <div className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-2">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em]" style={{ color: "#3a7a4a" }}>
          Winners
        </div>
        <ul className="mt-4 space-y-5">
          {wl.winners.length === 0 && (
            <li className="text-sm" style={{ ...serif, color: "#7a766c" }}>
              No clear winners identified.
            </li>
          )}
          {wl.winners.map((w, i) => (
            <li key={i} className="border-t pt-3" style={{ borderColor: "#d6d3ca" }}>
              <div className="text-lg" style={serif}>
                {w.group}
              </div>
              <div className="mt-1 text-sm leading-relaxed" style={{ ...serif, color: "#5a5650" }}>
                {w.why}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em]" style={{ color: "#a04438" }}>
          Losers
        </div>
        <ul className="mt-4 space-y-5">
          {wl.losers.length === 0 && (
            <li className="text-sm" style={{ ...serif, color: "#7a766c" }}>
              No clear losers identified.
            </li>
          )}
          {wl.losers.map((l, i) => (
            <li key={i} className="border-t pt-3" style={{ borderColor: "#d6d3ca" }}>
              <div className="text-lg" style={serif}>
                {l.group}
              </div>
              <div className="mt-1 text-sm leading-relaxed" style={{ ...serif, color: "#5a5650" }}>
                {l.why}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CitationsBlock({ cits }: { cits: Citation[] }) {
  const serif = { fontFamily: "'Fraunces', serif" };
  return (
    <div className="mt-12">
      <div className="text-[11px] uppercase tracking-[0.25em]" style={{ color: "#7a766c" }}>
        Citations from the bill
      </div>
      <ul className="mt-4 space-y-6">
        {cits.map((c, i) => (
          <li key={i} className="border-t pt-4" style={{ borderColor: "#d6d3ca" }}>
            <blockquote
              className="border-l pl-5 text-base leading-[1.7]"
              style={{ ...serif, borderColor: "#9a958a", color: "#2a2a2a" }}
            >
              "{c.quote}"
            </blockquote>
            <div
              className="mt-2 flex flex-wrap items-baseline gap-x-3 text-xs"
              style={{ ...serif, color: "#5a5650" }}
            >
              {c.section && <span>§ {c.section}</span>}
              <span>{c.why_matters}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PublishShare({
  state,
  billNo,
  title,
  sourceUrl,
  ai,
}: {
  state: string;
  billNo: string;
  title: string;
  sourceUrl: string;
  ai: AIState;
}) {
  const [slug, setSlug] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fn = useServerFn(createShare);

  async function publish() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fn({
        data: {
          state,
          bill_no: billNo,
          title,
          source_url: sourceUrl,
          payload: {
            quick: ai.quick,
            wl: ai.wl,
            citations: ai.citations,
            sc: ai.sc,
            sq: ai.sq,
          },
        },
      });
      setSlug(r.slug);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to publish");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  if (slug) {
    const url = `${window.location.origin}/b/${slug}`;
    return (
      <span className="flex items-baseline gap-3">
        <Link
          to="/b/$slug"
          params={{ slug }}
          className="text-xs underline underline-offset-4"
          style={{ fontFamily: "'Fraunces', serif", color: "#3a7a4a" }}
        >
          Open public page ↗
        </Link>
        <button
          onClick={() => copyLink(url)}
          className="text-xs underline-offset-4 hover:underline"
          style={{ fontFamily: "'Fraunces', serif", color: "#3a3a3a" }}
          title={url}
        >
          {copied ? "Link copied." : "Copy link"}
        </button>
      </span>
    );
  }
  return (
    <button
      onClick={publish}
      disabled={busy}
      className="text-xs underline-offset-4 hover:underline disabled:opacity-50"
      style={{ fontFamily: "'Fraunces', serif", color: err ? "#c4413a" : "#3a3a3a" }}
    >
      {busy ? "Publishing…" : err || "Publish as public page →"}
    </button>
  );
}

/** The optional "about you" answers from the search flow, shown so the reader knows what was used. */
function ReaderStrip() {
  const [profile, setProfile] = useState<ReaderProfile>({});
  useEffect(() => setProfile(readProfile()), []);
  const answers = Object.values(profile).filter(Boolean);
  if (answers.length === 0) return null;
  return (
    <div
      className="mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-2 border-t border-b py-4 text-sm"
      style={{ borderColor: "#d6d3ca", fontFamily: "'Fraunces', serif" }}
    >
      <span className="" style={{ color: "#7a766c" }}>
        Reading this for:
      </span>
      {answers.map((a) => (
        <span key={a} className="border px-2 py-0.5 text-xs" style={{ borderColor: "#d6d3ca" }}>
          {a}
        </span>
      ))}
      <button
        type="button"
        onClick={() => {
          clearProfile();
          setProfile({});
        }}
        className="ml-auto text-xs underline-offset-4 hover:underline"
        style={{ color: "#3a3a3a" }}
      >
        Forget my answers
      </button>
    </div>
  );
}
