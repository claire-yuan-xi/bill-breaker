import type { ReactNode } from "react";

/** A numbered admin section with a micro-label kicker, matching the site's editorial style. */
export function Panel({
  step,
  title,
  children,
}: {
  step: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-border py-10">
      <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{step}</div>
      <h2 className="mt-2 font-serif text-3xl font-bold tracking-tight">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}
