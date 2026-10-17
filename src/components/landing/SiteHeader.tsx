import { Link } from "@tanstack/react-router";
import { usePress } from "@/lib/press";
import { SavedBillsButton } from "@/components/saved/SavedBillsButton";

/** White over the hero photo; solid once `solid` is set (the hero has scrolled away). */
export function SiteHeader({ solid, onSearch }: { solid: boolean; onSearch: () => void }) {
  const searchRef = usePress<HTMLButtonElement>();
  return (
    <header
      className={
        "transition-colors duration-500 " +
        (solid ? "border-b border-border bg-background/95 backdrop-blur" : "bg-transparent")
      }
    >
      <div
        className={
          "mx-auto flex max-w-6xl items-center justify-between px-6 py-4 " +
          (solid ? "text-foreground" : "text-white")
        }
      >
        <Link to="/" className="flex items-center gap-2 text-sm font-medium tracking-tight">
          <span className={"inline-block h-2 w-2 " + (solid ? "bg-foreground" : "bg-white")} />
          <span>bill_breaker</span>
        </Link>
        <nav
          aria-label="Main"
          className="ml-auto mr-6 hidden items-center text-[11px] font-semibold uppercase tracking-[0.22em] md:flex"
        >
          <a href="#news" className="opacity-80 hover:opacity-100">
            News
          </a>
        </nav>
        <SavedBillsButton
          onSearch={onSearch}
          className="ml-auto mr-4 text-[11px] font-semibold uppercase tracking-[0.2em] opacity-90 hover:opacity-100 md:ml-0 md:mr-6"
        />
        <button
          ref={searchRef}
          type="button"
          onClick={onSearch}
          className={
            "relative overflow-hidden border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors " +
            (solid
              ? "border-foreground hover:bg-foreground hover:text-background"
              : "border-white/80 hover:bg-white hover:text-[#14171f]")
          }
        >
          Search
        </button>
      </div>
    </header>
  );
}
