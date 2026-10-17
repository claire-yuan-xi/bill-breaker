import { useEffect, useRef, useState } from "react";
import type { APItem } from "@/lib/ap-news.functions";
import { articleHref, cleanTitle, formatTime, topicFor } from "@/lib/news-format";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { useRailMotion } from "@/lib/rail-motion";

export type SortMode = "newest" | "oldest";
export type Timeframe = "24h" | "week" | "all";
type View = "rail" | "list";

type Props = {
  id: string;
  headlines: APItem[];
  totalAll: number;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  sort: SortMode;
  setSort: (s: SortMode) => void;
  timeframe: Timeframe;
  setTimeframe: (t: Timeframe) => void;
  onRefresh: () => void;
};

function Toggle<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: Array<readonly [T, string]>;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="inline-flex border border-border" role="group" aria-label={label}>
        {options.map(([k, text]) => (
          <button
            key={k}
            type="button"
            aria-pressed={value === k}
            onClick={() => onChange(k)}
            className={
              "px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.25em] transition-[color,background-color,transform] duration-150 active:scale-90 " +
              (value === k
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function NewsSection(props: Props) {
  const { id, headlines, totalAll, isLoading, isFetching, error } = props;
  const [view, setView] = useState<View>("rail");
  const railRef = useRef<HTMLUListElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  useRailMotion(railRef, barRef, [view, headlines]);

  // Cards deal in from the right the first time the section scrolls into view.
  useEffect(() => {
    if (!sectionRef.current || prefersReducedMotion() || headlines.length === 0) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-news-card]",
        {
          x: 120,
          opacity: 0,
          rotationY: -28,
          transformPerspective: 1200,
          transformOrigin: "0% 50%",
        },
        {
          x: 0,
          opacity: 1,
          rotationY: 0,
          duration: 1.1,
          ease: "expo.out",
          stagger: { each: 0.07, from: "start" },
          clearProps: "transform",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 70%",
            once: true,
          },
        },
      );
    }, sectionRef);
    return () => ctx.revert();
  }, [view, headlines.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const page = (dir: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({
      left: dir * rail.clientWidth * 0.85,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  const [lead, ...rest] = headlines;

  return (
    <section
      id={id}
      ref={sectionRef}
      aria-labelledby={`${id}-title`}
      className="relative border-b border-border bg-background"
    >
      <div className="mx-auto max-w-6xl px-6 pt-20">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2
              id={`${id}-title`}
              className="font-serif text-5xl font-bold tracking-tight md:text-6xl"
            >
              Today on the floor.
            </h2>
            <div className="mt-2 text-xs text-muted-foreground" aria-live="polite">
              {headlines.length === totalAll
                ? `${totalAll} stories`
                : `${headlines.length} of ${totalAll} stories`}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Toggle
              label="sort"
              value={props.sort}
              onChange={props.setSort}
              options={[
                ["newest", "Newest"],
                ["oldest", "Oldest"],
              ]}
            />
            <Toggle
              label="window"
              value={props.timeframe}
              onChange={props.setTimeframe}
              options={[
                ["24h", "24h"],
                ["week", "Week"],
                ["all", "All"],
              ]}
            />
            <Toggle
              label="view"
              value={view}
              onChange={setView}
              options={[
                ["rail", "Cards"],
                ["list", "List"],
              ]}
            />
            <button
              type="button"
              onClick={props.onRefresh}
              disabled={isFetching}
              aria-label="Refresh headlines"
              className="border border-border px-3 py-2 text-sm transition-transform duration-150 hover:border-foreground active:scale-90 disabled:opacity-50"
            >
              <span
                aria-hidden="true"
                className={"inline-block " + (isFetching ? "animate-spin" : "")}
              >
                ↻
              </span>
            </button>
          </div>
        </div>
      </div>

      {isLoading || headlines.length === 0 ? (
        <div className="mx-auto max-w-6xl px-6 py-16 text-sm text-muted-foreground">
          {isLoading
            ? "Loading headlines…"
            : error
              ? "AP headlines are temporarily unavailable. Try Refresh."
              : "No headlines in this window. Try widening the timeframe."}
        </div>
      ) : view === "rail" ? (
        <div className="pb-20 pt-10">
          <ul
            ref={railRef}
            tabIndex={0}
            aria-label="AP headlines. Use the arrow keys or scroll sideways."
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") page(1);
              if (e.key === "ArrowLeft") page(-1);
            }}
            className="news-rail flex gap-5 overflow-x-auto pb-6 focus-visible:outline-none"
          >
            {lead && (
              <li data-news-card className="shrink-0">
                <a
                  href={articleHref(lead.link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card-glare group flex h-[420px] w-[min(560px,86vw)] flex-col justify-between bg-[#14171f] p-8 text-white transition-[translate] duration-300 hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                >
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-white/60">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                      latest · {topicFor(lead.title)}
                    </span>
                    <span>{formatTime(lead.pubDate)}</span>
                  </div>
                  <h3 className="font-serif text-3xl font-semibold leading-[1.1] md:text-[2.6rem]">
                    {cleanTitle(lead.title)}
                  </h3>
                  <span className="flex items-center justify-between border-t border-white/20 pt-4 text-[11px] uppercase tracking-[0.25em]">
                    Read on AP
                    <span
                      aria-hidden="true"
                      className="transition-transform group-hover:translate-x-1"
                    >
                      ↗
                    </span>
                  </span>
                </a>
              </li>
            )}
            {rest.map((it, i) => (
              <li key={it.link + i} data-news-card className="shrink-0">
                <a
                  href={articleHref(it.link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card-glare group flex h-[420px] w-[290px] flex-col justify-between border border-border bg-[#fbf8f0] p-6 transition-[translate,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-foreground hover:shadow-[0_24px_40px_-24px_rgba(0,0,0,0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
                >
                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="font-serif text-5xl leading-none text-foreground/15">
                        {String(i + 2).padStart(2, "0")}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                        {formatTime(it.pubDate)}
                      </span>
                    </div>
                    <div className="mt-6 text-[10px] uppercase tracking-[0.3em] text-[#a6501a]">
                      {topicFor(it.title)}
                    </div>
                    <h3 className="mt-3 line-clamp-6 font-serif text-[1.6rem] font-semibold leading-[1.15]">
                      {cleanTitle(it.title)}
                    </h3>
                  </div>
                  <span className="flex items-center justify-between border-t border-border pt-4 text-[10px] uppercase tracking-[0.25em] text-muted-foreground group-hover:text-foreground">
                    Read on AP
                    <span
                      aria-hidden="true"
                      className="transition-transform group-hover:translate-x-1"
                    >
                      ↗
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>

          <div className="mx-auto mt-4 flex max-w-6xl items-center gap-6 px-6">
            <div className="h-px flex-1 bg-border" aria-hidden="true">
              <div ref={barRef} className="h-px origin-left scale-x-[0.06] bg-foreground" />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => page(-1)}
                aria-label="Previous headlines"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-border transition-transform duration-150 hover:border-foreground active:scale-90"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => page(1)}
                aria-label="More headlines"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-border transition-transform duration-150 hover:border-foreground active:scale-90"
              >
                →
              </button>
            </div>
          </div>
        </div>
      ) : (
        <ul className="mx-auto mt-10 max-w-6xl divide-y divide-border border-y border-border px-6 pb-4 mb-20">
          {headlines.map((it, i) => (
            <li
              key={it.link + i}
              data-news-card
              className="group flex flex-col gap-2 py-5 md:flex-row md:items-center md:gap-6"
            >
              <span className="w-24 shrink-0 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {formatTime(it.pubDate)}
              </span>
              <span className="w-28 shrink-0 text-[10px] uppercase tracking-[0.25em] text-[#a6501a]">
                {topicFor(it.title)}
              </span>
              <a
                href={articleHref(it.link)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 font-serif text-xl font-semibold leading-snug hover:text-[#a6501a]"
              >
                {cleanTitle(it.title)}
                <span className="sr-only"> (opens AP News in a new tab)</span>
              </a>
              <span aria-hidden="true" className="hidden text-muted-foreground md:block">
                ↗
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
