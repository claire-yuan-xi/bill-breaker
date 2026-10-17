import { useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import type { WatchItem } from "@/lib/watchlist";
import { useSavedBills } from "@/hooks/use-saved-bills";
import { useSavedBillActions } from "@/hooks/use-watchlist-sync";
import { useNotice } from "@/hooks/use-notice";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { NoticeBar } from "./NoticeBar";
import { SavedBillCard } from "./SavedBillCard";
import { SavedEmptyState } from "./SavedEmptyState";

/** Header button with a live count that opens the saved list from anywhere on the page. */
export function SavedBillsButton({
  className = "",
  onSearch,
}: {
  className?: string;
  onSearch?: () => void;
}) {
  const items = useSavedBills();
  const [open, setOpen] = useState(false);
  const { notice, show, dismiss } = useNotice();
  const actions = useSavedBillActions();
  const remove = (item: WatchItem) => {
    actions.remove(item);
    show({ text: `Removed ${item.bill_no}.`, undo: item });
  };
  const Icon = items.length > 0 ? BookmarkCheck : Bookmark;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Saved bills (${items.length})`}
        className={"flex items-center gap-2 " + className}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Saved</span>
        <span className="min-w-5 rounded-full bg-accent px-1.5 text-center text-[10px] font-medium leading-5 tracking-normal text-foreground">
          {items.length}
        </span>
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-serif text-3xl font-bold">Saved bills</SheetTitle>
            <SheetDescription>
              {items.length === 0
                ? "Bills you save show up here."
                : `${items.length} saved in this browser.`}
            </SheetDescription>
          </SheetHeader>
          <NoticeBar notice={notice} onDismiss={dismiss} />
          {items.length === 0 ? (
            <SavedEmptyState
              onSearch={
                onSearch &&
                (() => {
                  setOpen(false);
                  onSearch();
                })
              }
            />
          ) : (
            <ul className="mt-2 grid gap-3">
              {items.map((w) => (
                <SavedBillCard key={`${w.state}-${w.bill_no}`} item={w} onRemove={remove} compact />
              ))}
            </ul>
          )}
          <a
            href="#saved"
            onClick={() => setOpen(false)}
            className="mt-auto pt-4 text-[11px] uppercase tracking-[0.2em] text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Back up &amp; restore options
          </a>
        </SheetContent>
      </Sheet>
    </>
  );
}
