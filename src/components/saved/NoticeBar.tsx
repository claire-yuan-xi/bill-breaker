import { X } from "lucide-react";
import { restoreBill } from "@/lib/watchlist";
import type { Notice } from "@/hooks/use-notice";

export function NoticeBar({ notice, onDismiss }: { notice: Notice | null; onDismiss: () => void }) {
  return (
    <div role="status" aria-live="polite" className="min-h-0">
      {notice && (
        <div className="mt-6 flex items-center justify-between gap-4 border-l-2 border-accent bg-background px-4 py-3 text-sm shadow-sm">
          <span>{notice.text}</span>
          <span className="flex items-center gap-3">
            {notice.undo && (
              <button
                type="button"
                onClick={() => {
                  restoreBill(notice.undo!);
                  onDismiss();
                }}
                className="text-[11px] font-medium uppercase tracking-[0.2em] underline underline-offset-4 hover:text-accent"
              >
                Undo
              </button>
            )}
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss message"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
