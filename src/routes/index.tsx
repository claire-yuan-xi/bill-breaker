import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { getLegislationNews } from "@/lib/ap-news.functions";
import { SavedBillsSection } from "@/components/saved/SavedBillsSection";
import { CapitolHero } from "@/components/landing/CapitolHero";
import { NewsSection, type SortMode, type Timeframe } from "@/components/landing/NewsSection";
import { SearchDialog, type SearchMode } from "@/components/landing/SearchDialog";
import { BillDrift } from "@/components/landing/BillDrift";
import { FloatingExplain } from "@/components/landing/FloatingExplain";
import { ScrollTrigger } from "@/lib/motion";
import { useSmoothScroll } from "@/lib/smooth-scroll";
import { NewsTicker } from "@/components/landing/NewsTicker";
import { RecentBills } from "@/components/landing/RecentBills";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SearchCta } from "@/components/landing/SearchCta";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "BillBreaker — Legislation, in plain English" },
      {
        name: "description",
        content:
          "Live legislation headlines from AP News. Search a bill by state and number, or paste the text, to get a plain-English breakdown of how it affects you.",
      },
      {
        property: "og:title",
        content: "BillBreaker — Legislation, in plain English",
      },
      {
        property: "og:description",
        content:
          "Live AP legislation headlines and plain-English bill breakdowns. Free, no account needed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Index() {
  useSmoothScroll();
  const [recentCount, setRecentCount] = useState(0);
  const [sort, setSort] = useState<SortMode>("newest");
  const [timeframe, setTimeframe] = useState<Timeframe>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<SearchMode>("number");
  const [solidNav, setSolidNav] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  // The nav floats over the Capitol in white, then turns solid once the hero has gone.
  useEffect(() => {
    if (!heroRef.current) return;
    const st = ScrollTrigger.create({
      trigger: heroRef.current,
      start: "bottom 120px",
      onEnter: () => setSolidNav(true),
      onLeaveBack: () => setSolidNav(false),
    });
    return () => st.kill();
  }, []);

  const fetchNews = useServerFn(getLegislationNews);
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["ap-legislation"],
    queryFn: () => fetchNews(),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 2,
  });

  const items = useMemo(() => data?.items ?? [], [data]);

  const newestFirst = useMemo(
    () => [...items].sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0)),
    [items],
  );

  const filteredHeadlines = useMemo(() => {
    const now = Date.now();
    const cutoff =
      timeframe === "24h" ? now - 86_400_000 : timeframe === "week" ? now - 7 * 86_400_000 : 0;
    const filtered = items.filter((it) => {
      if (!cutoff) return true;
      const t = new Date(it.pubDate).getTime();
      return !isNaN(t) && t >= cutoff;
    });
    filtered.sort((a, b) => {
      const ta = new Date(a.pubDate).getTime() || 0;
      const tb = new Date(b.pubDate).getTime() || 0;
      return sort === "newest" ? tb - ta : ta - tb;
    });
    return filtered;
  }, [items, sort, timeframe]);

  // Lists above the news section change height after mount; keep trigger positions honest.
  useEffect(() => {
    ScrollTrigger.refresh();
  }, [recentCount, filteredHeadlines.length]);

  function openSearch(m: SearchMode = "number") {
    setMode(m);
    setDialogOpen(true);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <a
        href="#news"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-background focus:px-4 focus:py-2"
      >
        Skip to news
      </a>

      <div className="fixed inset-x-0 top-0 z-50">
        <NewsTicker items={newestFirst} loading={isLoading} />
        <SiteHeader solid={solidNav} onSearch={() => openSearch("number")} />
      </div>

      <div ref={heroRef} id="hero">
        <CapitolHero
          onSearch={() => openSearch("number")}
          onPaste={() => openSearch("paste")}
        />
      </div>

      <RecentBills onChange={setRecentCount} />

      <NewsSection
        id="news"
        headlines={filteredHeadlines}
        totalAll={items.length}
        isLoading={isLoading}
        isFetching={isFetching}
        error={data?.error ?? (isError ? "Could not load live headlines" : null)}
        sort={sort}
        setSort={setSort}
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        onRefresh={() => refetch()}
      />

      <SavedBillsSection onSearch={() => openSearch("number")} />

      <SearchCta onSearch={() => openSearch("number")} onPaste={() => openSearch("paste")} />

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-10 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        <span>Non-partisan · Not legal advice</span>
        <span>News: AP · Bills: Congress.gov, state legislatures</span>
      </footer>

      <BillDrift avoid={["#news", "#saved", "[data-bill-avoid]"]} />
      <FloatingExplain after="#hero" onClick={() => openSearch("number")} />
      <SearchDialog
        open={dialogOpen}
        mode={mode}
        onOpenChange={setDialogOpen}
        onModeChange={setMode}
      />
    </main>
  );
}
