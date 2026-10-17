import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

const RECENT_KEY = "bb_recent_v1";
type RecentItem = { state: string; number: string; title: string; ts: number };

function readRecent(): RecentItem[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as RecentItem[]) : [];
  } catch {
    return [];
  }
}

/** Bills this browser looked up recently. Renders nothing until there is one. */
export function RecentBills({ onChange }: { onChange?: (count: number) => void }) {
  const [recent, setRecent] = useState<RecentItem[]>([]);

  useEffect(() => {
    setRecent(readRecent());
  }, []);

  useEffect(() => {
    onChange?.(recent.length);
  }, [recent.length, onChange]);

  function clearRecent() {
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {
      /* */
    }
    setRecent([]);
  }

  if (recent.length === 0) return null;
  return (
    <section className="border-b border-border bg-secondary/20">
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Recent</div>
          <button
            onClick={clearRecent}
            className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground"
          >
            clear
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {recent.map((r) => (
            <Link
              key={`${r.state}-${r.number}-${r.ts}`}
              to="/bill"
              search={{ state: r.state, number: r.number, text: "" }}
              className="group flex items-center gap-3 border border-border bg-background px-3 py-2 text-xs hover:border-foreground"
            >
              <span className="text-[10px] uppercase tracking-[0.25em] text-[#a6501a]">
                {r.state}
              </span>
              <span className="font-medium">{r.number}</span>
              <span className="max-w-[200px] truncate text-muted-foreground group-hover:text-foreground">
                {r.title}
              </span>
              <span className="text-[10px] text-muted-foreground">↗</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
