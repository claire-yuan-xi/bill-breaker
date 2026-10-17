import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { isSaved, retitleBill } from "@/lib/watchlist";
import { usePress } from "@/lib/press";
import { useSavedBills } from "@/hooks/use-saved-bills";
import { useSavedBillActions } from "@/hooks/use-watchlist-sync";

/** Save / unsave button for the bill page header. */
export function SaveBillToggle({
  state,
  billNo,
  title,
}: {
  state: string;
  billNo: string;
  title: string;
}) {
  const saved = useSavedBills();
  const { save, remove } = useSavedBillActions();
  const [ready, setReady] = useState(false);
  const pressRef = usePress<HTMLButtonElement>();
  const watching = isSaved(state, billNo, saved);

  useEffect(() => setReady(true), []);

  // Bills saved before the real title arrived get it filled in later.
  useEffect(() => {
    if (watching) retitleBill(state, billNo, title);
  }, [watching, state, billNo, title]);

  if (!ready) return null;
  return (
    <span className="inline-flex items-center gap-3">
      <button
        ref={pressRef}
        type="button"
        onClick={() => (watching ? remove({ state, bill_no: billNo }) : save(state, billNo, title))}
        aria-pressed={watching}
        className="relative inline-flex items-center gap-2 overflow-hidden rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors"
        style={{
          fontFamily: "'Fraunces', serif",
          borderColor: watching ? "#1a1a1a" : "#bdb8ab",
          background: watching ? "#1a1a1a" : "transparent",
          color: watching ? "#faf8f3" : "#1a1a1a",
        }}
      >
        <Star
          className="h-3.5 w-3.5"
          fill={watching ? "currentColor" : "none"}
          aria-hidden="true"
        />
        {watching ? "Saved" : "Save bill"}
      </button>
      {watching && (
        <Link
          to="/"
          hash="saved"
          className="text-xs underline underline-offset-4"
          style={{ fontFamily: "'Fraunces', serif", color: "#7a766c" }}
        >
          See saved bills ({saved.length})
        </Link>
      )}
    </span>
  );
}
