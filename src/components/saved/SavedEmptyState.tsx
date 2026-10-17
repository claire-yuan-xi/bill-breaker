import { Bookmark } from "lucide-react";
import { usePress } from "@/lib/press";

export function SavedEmptyState({ onSearch }: { onSearch?: () => void }) {
  const pressRef = usePress<HTMLButtonElement>();
  return (
    <div className="@container border border-dashed border-foreground/30 bg-background/60">
      <div className="flex flex-col items-start gap-5 p-6 @2xl:flex-row @2xl:items-center @2xl:justify-between @2xl:p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
            <Bookmark className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-serif text-2xl font-bold">Nothing saved yet</p>
            <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
              Open a bill and press <strong className="text-foreground">Save bill</strong>
            </p>
          </div>
        </div>
        {onSearch && (
          <button
            ref={pressRef}
            type="button"
            onClick={onSearch}
            className="relative shrink-0 overflow-hidden bg-foreground px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-background hover:bg-foreground/85"
          >
            Find a bill{" "}
            <span data-press-arrow className="inline-block">
              →
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
