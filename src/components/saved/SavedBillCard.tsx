import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import type { WatchItem } from "@/lib/watchlist";
import { formatRelative } from "@/lib/cached-badge";
import { STATES } from "@/lib/states";
import { usePress } from "@/lib/press";

const STATE_NAMES = new Map(STATES);

function placeName(state: string) {
  return state === "US" ? "Federal" : (STATE_NAMES.get(state) ?? state);
}

export function SavedBillCard({
  item,
  onRemove,
  compact = false,
}: {
  item: WatchItem;
  onRemove: (item: WatchItem) => void;
  compact?: boolean;
}) {
  const label = `${item.state === "US" ? "" : item.state + " "}${item.bill_no}`;
  const openRef = usePress<HTMLAnchorElement>();
  return (
    <li className="group flex flex-col border border-border bg-background p-5 transition duration-300 hover:-translate-y-0.5 hover:border-foreground hover:shadow-[0_14px_30px_-18px_rgba(0,0,0,0.45)]">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <span className="bg-foreground px-2 py-1 text-[10px] uppercase tracking-[0.22em] text-background">
            {placeName(item.state)}
          </span>
          <span className="text-sm font-medium tracking-wide">{item.bill_no}</span>
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          saved {formatRelative(new Date(item.ts).toISOString())}
        </span>
      </div>
      <p
        className={
          "mt-4 flex-1 font-serif font-semibold leading-[1.2] " +
          (compact ? "line-clamp-2 text-lg" : "line-clamp-3 text-2xl")
        }
      >
        {item.title || label}
      </p>
      <div className="mt-5 flex items-center gap-2">
        <Link
          to="/bill"
          ref={openRef}
          search={{ state: item.state, number: item.bill_no, text: "" }}
          className="relative flex flex-1 items-center justify-between overflow-hidden bg-foreground px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-background hover:bg-foreground/85"
        >
          Read breakdown
          <span aria-hidden="true" data-press-arrow className="inline-block">
            →
          </span>
        </Link>
        <button
          type="button"
          onClick={() => onRemove(item)}
          aria-label={`Remove ${label} from saved bills`}
          title="Remove"
          className="flex h-[42px] w-[42px] items-center justify-center border border-border text-muted-foreground hover:border-destructive hover:text-destructive"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
