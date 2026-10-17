import { createFileRoute, Link } from "@tanstack/react-router";
import { ModelScorecard } from "@/components/admin/ml/ModelScorecard";
import { ModelStatus } from "@/components/admin/ml/ModelStatus";
import { NotebookTrace } from "@/components/admin/ml/NotebookTrace";
import { Panel } from "@/components/admin/ml/Panel";
import { Playground } from "@/components/admin/ml/Playground";
import { SampleOutputs } from "@/components/admin/ml/SampleOutputs";

export const Route = createFileRoute("/admin/ml")({
  ssr: false,
  component: AdminMlPage,
  head: () => ({
    meta: [
      { title: "BillBreaker — Model admin" },
      {
        name: "description",
        content: "How the Bill Breaker model scores, ranks and explains bills.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function AdminMlPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-sm font-medium tracking-tight">
            <span className="inline-block h-2 w-2 bg-foreground" />
            <span>bill_breaker</span>
          </Link>
          <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Admin · Model
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 pb-24">
        <div className="py-12">
          <h1 className="font-serif text-5xl font-bold tracking-tight md:text-6xl">
            How the model explains a bill.
          </h1>
          <div className="mt-8">
            <ModelStatus />
          </div>
        </div>

        <Panel step="01 · Quality" title="Fine-tuning doubled summary overlap">
          <ModelScorecard />
        </Panel>

        <Panel step="02 · Samples" title="Model output next to the official summary">
          <SampleOutputs />
        </Panel>

        <NotebookTrace />

        <Panel step="07 · Try it" title="Run the pipeline on any bill">
          <Playground />
        </Panel>
      </div>
    </main>
  );
}
