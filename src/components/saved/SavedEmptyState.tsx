import { Bookmark } from "lucide-react";
import { usePress } from "@/lib/press";

export function SavedEmptyState({ onSearch }: { onSearch?: () => void }) {
  const pressRef = usePress<HTMLButtonElement>();
  return (
    <div className="flex flex-col items-start gap-5 border border-dashed border-foreground/30 bg-background/60 p-8 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
          <Bookmark className="h-5 w-5" />
        </span>
        <div>
          <p className="font-serif text-2xl font-bold">Nothing saved yet.</p>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
            Open any bill and press <strong className="text-foreground">Save bill</strong>. It lands
            here so you can come back to it. No account needed; it's kept in this browser.
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
          Find a bill to save{" "}
          <span data-press-arrow className="inline-block">
            →
          </span>
        </button>
      )}
    </div>
  );
}
