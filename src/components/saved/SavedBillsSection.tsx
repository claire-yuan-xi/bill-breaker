import { useCallback, useState } from "react";
import type { WatchItem } from "@/lib/watchlist";
import { usePress } from "@/lib/press";
import { useSavedBills } from "@/hooks/use-saved-bills";
import { useCloudPullOnce, useSavedBillActions } from "@/hooks/use-watchlist-sync";
import { useNotice } from "@/hooks/use-notice";
import { BackupTools } from "./BackupTools";
import { NoticeBar } from "./NoticeBar";
import { SavedBillCard } from "./SavedBillCard";
import { SavedEmptyState } from "./SavedEmptyState";

const PREVIEW = 6;

/** The saved-bills block on the landing page. */
export function SavedBillsSection({ onSearch }: { onSearch?: () => void }) {
  const items = useSavedBills();
  const [showAll, setShowAll] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const { notice, show, dismiss } = useNotice();
  const actions = useSavedBillActions();
  const remove = (item: WatchItem) => {
    actions.remove(item);
    show({ text: `Removed ${item.bill_no} from your saved bills.`, undo: item });
  };
  const notify = useCallback((text: string) => show({ text }), [show]);
  useCloudPullOnce(notify);
  const visible = showAll ? items : items.slice(0, PREVIEW);
  const addRef = usePress<HTMLButtonElement>();
  const toolsRef = usePress<HTMLButtonElement>();

  return (
    <section
      id="saved"
      aria-labelledby="saved-title"
      className="scroll-mt-28 border-b border-border bg-secondary/40"
    >
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2
              id="saved-title"
              className="flex items-baseline gap-4 font-serif text-4xl font-bold tracking-tight md:text-5xl"
            >
              Saved bills
              <span className="rounded-full bg-accent px-3 py-0.5 font-sans text-sm font-medium text-foreground">
                {items.length}
              </span>
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onSearch && items.length > 0 && (
              <button
                ref={addRef}
                type="button"
                onClick={onSearch}
                className="relative overflow-hidden border border-foreground px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] hover:bg-foreground hover:text-background"
              >
                + Add another bill
              </button>
            )}
            <button
              ref={toolsRef}
              type="button"
              onClick={() => setToolsOpen((v) => !v)}
              aria-expanded={toolsOpen}
              aria-controls="saved-tools"
              className="relative overflow-hidden border border-border bg-background px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] hover:border-foreground"
            >
              {toolsOpen ? "Hide backup options" : "Back up & restore"}
            </button>
          </div>
        </div>

        <NoticeBar notice={notice} onDismiss={dismiss} />

        {toolsOpen && (
          <div id="saved-tools" className="mt-6">
            <BackupTools items={items} onNotice={notify} />
          </div>
        )}

        <div className="mt-8">
          {items.length === 0 ? (
            <SavedEmptyState onSearch={onSearch} />
          ) : (
            <>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((w) => (
                  <SavedBillCard key={`${w.state}-${w.bill_no}`} item={w} onRemove={remove} />
                ))}
              </ul>
              {items.length > PREVIEW && (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="mt-6 text-[11px] uppercase tracking-[0.2em] underline underline-offset-4 hover:text-accent"
                >
                  {showAll ? "Show fewer" : `Show all ${items.length}`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
