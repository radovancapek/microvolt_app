import { PillButton } from "@/components/ui";

export default function MouserImportPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <section className="rounded-2xl bg-micro-olive px-6 py-10 text-white">
        <h1 className="text-3xl font-semibold tracking-tight">
          Import objednávky (Mouser)
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/75">
          Nahraj export z Mouseru (XLSX/CSV). Aplikace přičte kusy do „on
          order“. Neexistující součástky automaticky vytvoří.
        </p>

        <div className="mt-6">
          <PillButton>+ Nahrát objednávku</PillButton>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 ring-1 ring-black/10">
        <h2 className="text-lg font-semibold text-black/80">Import</h2>
        <p className="mt-1 text-sm text-black/60">
          Tady přidáme upload + mapování + potvrzení importu.
        </p>
      </section>
    </main>
  );
}