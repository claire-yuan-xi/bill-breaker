import { usePress } from "@/lib/press";

/** Closing call to action. The drifting bill steps aside for its buttons (data-bill-avoid). */
export function SearchCta({ onSearch, onPaste }: { onSearch: () => void; onPaste: () => void }) {
  const searchRef = usePress<HTMLButtonElement>({ magnetic: true });
  const pasteRef = usePress<HTMLButtonElement>();
  return (
    <section aria-labelledby="cta-title" className="border-b border-border">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-24 md:grid-cols-12 md:items-end">
        <div className="md:col-span-7">
          <h2
            id="cta-title"
            className="font-serif text-5xl font-bold leading-[1.02] tracking-tight md:text-7xl"
          >
            Got a bill number
          </h2>
        </div>
        <div data-bill-avoid className="flex flex-col gap-3 md:col-span-5">
          <button
            ref={searchRef}
            type="button"
            onClick={onSearch}
            className="group relative flex items-center justify-between overflow-hidden bg-foreground px-8 py-7 text-background"
          >
            <span className="font-serif text-3xl font-bold">Search a bill</span>
            <span
              data-press-arrow
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-accent font-bold text-foreground"
            >
              →
            </span>
          </button>
          <button
            ref={pasteRef}
            type="button"
            onClick={onPaste}
            className="relative overflow-hidden border border-border px-8 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.25em] hover:border-foreground"
          >
            Paste text
          </button>
        </div>
      </div>
    </section>
  );
}
