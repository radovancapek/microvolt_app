"use client";

import { useRef, useState } from "react";
import { MouserFilePreviewMapper } from "@/components/MouserFilePreviewMapper";
import { PillButton } from "@/components/ui";

type ImportResponse = {
  batchId: string;
  salesOrderNo: string | null;
  createdParts: number;
  updatedParts: number;
  descriptionFilled?: number;
  errorLines: number;
};

type ErrorPayload = {
  message: string;
  status?: number;
  details?: unknown;
};

function ResultBar({
  loading,
  result,
  error,
  onCloseError,
}: {
  loading: boolean;
  result: ImportResponse | null;
  error: ErrorPayload | null;
  onCloseError: () => void;
}) {
  if (!loading && !result && !error) return null;

  return (
    <div className="fixed left-1/2 top-20 z-50 w-[min(720px,calc(100vw-3rem))] -translate-x-1/2">
      {loading && (
        <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/10">
          <p className="text-sm text-black/70">Importuji…</p>
        </div>
      )}

      {!loading && result && (

        <div className="rounded-xl bg-white px-4 py-3 shadow-xl shadow-black/10 ring-1 ring-emerald-300">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-black/80">
                Import dokončen
              </p>
              <p className="mt-1 text-sm text-black/70">
                Batch: <span className="font-medium">{result.batchId}</span>
                {result.salesOrderNo ? (
                  <>
                    {" "}
                    • Sales Order:{" "}
                    <span className="font-medium">{result.salesOrderNo}</span>
                  </>
                ) : null}
              </p>
            </div>

            <div className="text-sm text-black/70">
              <span className="mr-4">
                Nové: <span className="font-semibold">{result.createdParts}</span>
              </span>
              <span className="mr-4">
                Aktualizované:{" "}
                <span className="font-semibold">{result.updatedParts}</span>
              </span>
              <span className="mr-4">
                Doplněné popisy:{" "}
                <span className="font-semibold">
                  {result.descriptionFilled ?? 0}
                </span>
              </span>
              <span>
                Chybné řádky:{" "}
                <span className="font-semibold">{result.errorLines}</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-red-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-red-700">
                Import se nepovedl
              </p>
              <p className="mt-1 text-sm text-red-700">{error.message}</p>
              {typeof error.status === "number" && (
                <p className="mt-1 text-xs text-red-700/80">
                  Status: {error.status}
                </p>
              )}
            </div>

            <PillButton variant="secondary" onClick={onCloseError}>
              Zavřít
            </PillButton>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MouserImportPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<ErrorPayload | null>(null);

  const topRef = useRef<HTMLDivElement | null>(null);

  async function runImport(
    items: Array<{ partNumber: string; qty: number; description?: string }>,
    meta: { fileName: string; salesOrderNo?: string }
  ) {
    setLoading(true);
    setResult(null);
    setError(null);

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
        throw {
          message: `Import API nevrátilo JSON (status ${res.status}).`,
          status: res.status,
          details: text.slice(0, 300),
        } satisfies ErrorPayload;
      }

      if (!res.ok) {
        const d = data as { error?: string };
        throw {
          message: d.error ?? "Chyba importu.",
          status: res.status,
          details: data,
        } satisfies ErrorPayload;
      }

      setResult(data as ImportResponse);
    } catch (e) {
      const payload =
        typeof e === "object" && e && "message" in e
          ? (e as ErrorPayload)
          : { message: "Neznámá chyba." };

      setError(payload);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="w-full px-6 py-8 space-y-6">
      <div ref={topRef} />

      <ResultBar
        loading={loading}
        result={result}
        error={error}
        onCloseError={() => setError(null)}
      />

      <section className="rounded-2xl bg-micro-olive px-6 py-10 text-white">
        <h1 className="text-3xl font-semibold tracking-tight">
          Import objednávky (Mouser)
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-white/75">
          Nahraj export (.xls/.xlsx), aplikace udělá preview a importuje kusy do
          “on order”. Duplicitní objednávka (Sales Order No.) je blokována.
        </p>
      </section>

      <MouserFilePreviewMapper title="Nahrát Mouser export" onConfirm={runImport} />
    </main>
  );
}