import type { APItem } from "@/lib/ap-news.functions";
import { articleHref, cleanTitle, formatTime } from "@/lib/news-format";

export function NewsTicker({ items, loading }: { items: APItem[]; loading: boolean }) {
  if (loading || items.length === 0) {
    return (
      <div className="border-b border-border bg-background/95 px-6 py-2.5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground backdrop-blur">
        {loading ? "loading live headlines…" : "live headlines unavailable"}
      </div>
    );
  }
  const loop = [...items, ...items];
  return (
    <div className="marquee-pause overflow-hidden border-b border-border bg-background/95 backdrop-blur">
      <div className="flex items-center">
        <div className="flex shrink-0 items-center gap-2 bg-foreground px-4 py-2.5 text-[10px] uppercase tracking-[0.25em] text-background">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          live · ap news
        </div>
        <div className="min-w-0 overflow-hidden">
          <div className="flex w-max animate-marquee whitespace-nowrap">
            {loop.map((it, i) => (
              <a
                key={i}
                href={articleHref(it.link)}
                target="_blank"
                rel="noopener noreferrer"
                tabIndex={i >= items.length ? -1 : undefined}
                aria-hidden={i >= items.length ? true : undefined}
                className="flex items-baseline gap-3 px-6 py-2.5 text-xs hover:text-accent"
              >
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {formatTime(it.pubDate)}
                </span>
                <span>{cleanTitle(it.title)}</span>
                <span className="text-muted-foreground">·</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
