"use client";

import { useState } from "react";
import { MouserFilePreviewMapper } from "@/components/MouserFilePreviewMapper";

type ImportResponse = {
  batchId: string;
  createdParts: number;
  updatedParts: number;
  errorLines: number;
};

export default function MouserImportPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState("");

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <section className="rounded-2xl bg-micro-olive px-6 py-10 text-white">
        <h1 className="text-3xl font-semibold tracking-tight">
          Import objednávky (Mouser)
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/75">
          Nahraj Mouser export (.xls nebo .xlsx). Aplikace si udělá preview,
          namapuješ sloupce a my přičteme kusy do “on order”. Neexistující
          součástky vytvoříme.
        </p>
      </section>

      <MouserFilePreviewMapper
        title="Nahrát Mouser export"
        onConfirm={async (items, meta) => {
          setError("");
          setResult(null);
          setLoading(true);

          try {
            const res = await fetch("/api/mouser/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fileName: meta.fileName,
                salesOrderNo: meta.salesOrderNo,
                items,
              }),
            });

            const text = await res.text();
            let data: unknown;
            try {
              data = JSON.parse(text);
            } catch {
              throw new Error(
                `Import API nevrátilo JSON (status ${res.status}): ${text.slice(
                  0,
                  200
                )}`
              );
            }

            if (!res.ok) {
              const d = data as { error?: string };
              throw new Error(d.error ?? `Chyba API (status ${res.status})`);
            }

            setResult(data as ImportResponse);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Neznámá chyba");
          } finally {
            setLoading(false);
          }
        }}
      />

      {loading && (
        <div className="rounded-2xl bg-white p-6 ring-1 ring-black/10">
          <p className="text-sm text-black/60">Importuji…</p>
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-white p-6 ring-1 ring-red-200">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {result && (
        <div className="rounded-2xl bg-white p-6 ring-1 ring-black/10 space-y-2">
          <h2 className="text-lg font-semibold text-black/80">Výsledek</h2>
          <p className="text-sm text-black/70">
            Batch: <span className="font-medium">{result.batchId}</span>
          </p>
          <ul className="text-sm text-black/70">
            <li>Nové součástky: {result.createdParts}</li>
            <li>Aktualizované (on_order +): {result.updatedParts}</li>
            <li>Chybné řádky: {result.errorLines}</li>
          </ul>
        </div>
      )}
    </main>
  );
}