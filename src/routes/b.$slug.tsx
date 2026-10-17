import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getShare } from "@/lib/user.functions";
import { SafeExternalLink } from "@/lib/safe-link";

export const Route = createFileRoute("/b/$slug")({
  loader: async ({ params }) => {
    const row = await getShare({ data: { slug: params.slug } });
    if (!row) throw notFound();
    return row;
  },
  component: SharePage,
  notFoundComponent: () => (
    <main
      className="min-h-screen px-6 py-24 text-center"
      style={{ background: "#faf8f3", color: "#1a1a1a", fontFamily: "'Fraunces', serif" }}
    >
      <h1 className="text-5xl">Not found.</h1>
      <p className="mt-4">This share link has expired or never existed.</p>
      <Link to="/" className="mt-8 inline-block underline">
        Return home
      </Link>
    </main>
  ),
  errorComponent: () => (
    <main
      className="min-h-screen px-6 py-24 text-center"
      style={{ background: "#faf8f3", color: "#c4413a", fontFamily: "'Fraunces', serif" }}
    >
      <h1 className="text-4xl">Could not load this page.</h1>
      <p className="mt-4" style={{ color: "#7a766c" }}>
        The share link may have expired or been removed.
      </p>
      <Link to="/" className="mt-8 inline-block underline" style={{ color: "#1a1a1a" }}>
        Return home
      </Link>
    </main>
  ),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Bill Breaker — ${loaderData.title || `${loaderData.state} ${loaderData.bill_no}`}`
          : "Bill Breaker",
      },
      {
        name: "description",
        content: loaderData?.title
          ? `Plain-English breakdown of ${loaderData.title}`
          : "Plain-English bill analysis.",
      },
      {
        property: "og:title",
        content: loaderData
          ? `BillBreaker — ${loaderData.title || `${loaderData.state} ${loaderData.bill_no}`}`
          : "BillBreaker — Shared analysis",
      },
      {
        property: "og:description",
        content: loaderData?.title
          ? `Plain-English breakdown of ${loaderData.title}`
          : "Shared plain-English bill analysis.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Payload = {
  quick?: {
    tldr: string;
    controversy_score: number;
    controversy_reason: string;
    dollar_impact: string;
    timeline: string;
  };
  wl?: { winners: { group: string; why: string }[]; losers: { group: string; why: string }[] };
  citations?: { quote: string; section: string; why_matters: string }[];
  sc?: { supporters: { point: string; who: string }[]; critics: { point: string; who: string }[] };
  sq?: { changes: { today: string; after: string; magnitude: string }[] };
};

function SharePage() {
  const row = Route.useLoaderData();
  const p = (row.payload || {}) as Payload;
  const serif = { fontFamily: "'Fraunces', serif" };

  return (
    <main className="min-h-screen" style={{ background: "#faf8f3", color: "#1a1a1a" }}>
      <header className="border-b" style={{ borderColor: "#d6d3ca" }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
          <Link to="/" className="text-2xl" style={serif}>
            Bill Breaker
          </Link>
          <span className="text-xs" style={{ ...serif, color: "#7a766c" }}>
            Shared analysis
          </span>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-16">
        <div className="text-[11px] uppercase tracking-[0.25em]" style={{ color: "#7a766c" }}>
          {row.state} · {row.bill_no}
        </div>
        <h1 className="mt-5 text-5xl leading-[1.05] md:text-6xl" style={serif}>
          {row.title || `${row.state} ${row.bill_no}`}
        </h1>
        <div className="mt-4 flex flex-wrap gap-x-6 text-xs" style={{ ...serif, color: "#3a3a3a" }}>
          {row.source_url && (
            <SafeExternalLink
              href={row.source_url}
              className="underline underline-offset-4"
              fallbackText="Source unavailable"
            >
              Open official source ↗
            </SafeExternalLink>
          )}
          <Link
            to="/bill"
            search={{ state: row.state, number: row.bill_no }}
            className="underline underline-offset-4"
          >
            Run your own analysis →
          </Link>
        </div>

        {p.quick && (
          <section className="mt-12">
            <p className="text-2xl leading-[1.4]" style={serif}>
              {p.quick.tldr}
            </p>
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
              <Stat
                label="Controversy"
                value={`${p.quick.controversy_score}/10`}
                sub={p.quick.controversy_reason}
              />
              <Stat label="Dollar impact" value={p.quick.dollar_impact} />
              <Stat label="Timeline" value={p.quick.timeline} />
            </div>
          </section>
        )}

        {p.sq?.changes?.length ? (
          <section className="mt-16">
            <H2>Compared to current law</H2>
            <ul className="mt-4 space-y-6">
              {p.sq.changes.map((c, i) => (
                <li
                  key={i}
                  className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2"
                  style={{ borderColor: "#d6d3ca" }}
                >
                  <div>
                    <Kicker>Today</Kicker>
                    <div
                      className="mt-1 text-base leading-[1.6]"
                      style={{ ...serif, color: "#3a3a3a" }}
                    >
                      {c.today}
                    </div>
                  </div>
                  <div>
                    <Kicker>If passed · {c.magnitude}</Kicker>
                    <div className="mt-1 text-base leading-[1.6]" style={serif}>
                      {c.after}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {p.wl && (
          <section className="mt-16 grid grid-cols-1 gap-10 md:grid-cols-2">
            <div>
              <Kicker color="#3a7a4a">Winners</Kicker>
              <ul className="mt-4 space-y-5">
                {p.wl.winners.map((w, i) => (
                  <Item key={i} h={w.group} s={w.why} />
                ))}
              </ul>
            </div>
            <div>
              <Kicker color="#a04438">Losers</Kicker>
              <ul className="mt-4 space-y-5">
                {p.wl.losers.map((l, i) => (
                  <Item key={i} h={l.group} s={l.why} />
                ))}
              </ul>
            </div>
          </section>
        )}

        {p.sc && (
          <section className="mt-16 grid grid-cols-1 gap-10 md:grid-cols-2">
            <div>
              <Kicker>What supporters say</Kicker>
              <ul className="mt-4 space-y-5">
                {p.sc.supporters.map((s, i) => (
                  <Item key={i} h={s.point} s={`— ${s.who}`} />
                ))}
              </ul>
            </div>
            <div>
              <Kicker>What critics say</Kicker>
              <ul className="mt-4 space-y-5">
                {p.sc.critics.map((s, i) => (
                  <Item key={i} h={s.point} s={`— ${s.who}`} />
                ))}
              </ul>
            </div>
          </section>
        )}

        {p.citations?.length ? (
          <section className="mt-16">
            <H2>Citations from the bill</H2>
            <ul className="mt-4 space-y-6">
              {p.citations.map((c, i) => (
                <li key={i} className="border-t pt-4" style={{ borderColor: "#d6d3ca" }}>
                  <blockquote
                    className="border-l pl-5 text-base leading-[1.7]"
                    style={{ ...serif, borderColor: "#9a958a", color: "#2a2a2a" }}
                  >
                    "{c.quote}"
                  </blockquote>
                  <div className="mt-2 text-xs" style={{ ...serif, color: "#5a5650" }}>
                    {c.section && <>§ {c.section} · </>}
                    {c.why_matters}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </main>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-4xl" style={{ fontFamily: "'Fraunces', serif" }}>
      {children}
    </h2>
  );
}
function Kicker({ children, color = "#7a766c" }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="text-[11px] uppercase tracking-[0.25em]" style={{ color }}>
      {children}
    </div>
  );
}
function Item({ h, s }: { h: string; s: string }) {
  const serif = { fontFamily: "'Fraunces', serif" };
  return (
    <li className="border-t pt-3" style={{ borderColor: "#d6d3ca" }}>
      <div className="text-lg" style={serif}>
        {h}
      </div>
      <div className="mt-1 text-sm leading-relaxed" style={{ ...serif, color: "#5a5650" }}>
        {s}
      </div>
    </li>
  );
}
function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const serif = { fontFamily: "'Fraunces', serif" };
  return (
    <div className="border-t pt-4" style={{ borderColor: "#d6d3ca" }}>
      <Kicker>{label}</Kicker>
      <div className="mt-2 text-xl leading-snug" style={serif}>
        {value}
      </div>
      {sub && (
        <div className="mt-2 text-xs" style={{ ...serif, color: "#5a5650" }}>
          {sub}
        </div>
      )}
    </div>
  );
}
