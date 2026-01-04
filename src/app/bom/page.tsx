"use client";

import { useState } from "react";
import { FilePreviewMapper } from "@/components/FilePreviewMapper";

type ResultItem = {
  partNumber: string;
  qtyRequired: number;
  knownPart: boolean;
  feederNos: string[];

  onHand: number;
  reserved: number;
  onOrder: number;
  availableNow: number;
  availableFuture: number;

  shortageNow: number;
  shortageFuture: number;

  moq: number;
  orderMultiple: number;
  orderQty: number;

  status: "OK" | "WAITING" | "ORDER";
  assigned: boolean;
};

function StatusBadge({ status }: { status: ResultItem["status"] }) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1";
  if (status === "OK") {
    return (
      <span className={`${base} bg-micro-lime/80 text-black ring-black/10`}>
        OK
      </span>
    );
  }
  if (status === "WAITING") {
    return (
      <span className={`${base} bg-black/5 text-black/80 ring-black/10`}>
        ČEKÁ SE
      </span>
    );
  }
  return (
    <span className={`${base} bg-white text-black/80 ring-black/20`}>
      OBJEDNAT
    </span>
  );
}

export default function BomPage() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ResultItem[] | null>(null);
  const [error, setError] = useState("");

  return (
    <main className="mx-auto w-full px-6 py-8 space-y-6">
      <section className="rounded-2xl bg-micro-olive px-6 py-10 text-white">
        <h1 className="text-3xl font-semibold tracking-tight">
          Kontrola BOM vs sklad
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/75">
          Vyhodnocujeme proti skladem + objednáno. Neznámé PN bereme jako
          „objednat“. Pro objednání počítáme MOQ a násobky.
        </p>
      </section>

      <FilePreviewMapper
        title="Nahrát BOM"
        onConfirm={async (mapped) => {
          setError("");
          setLoading(true);
          setItems(null);

          try {
            const res = await fetch("/api/bom/check", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ items: mapped }),
            });

            const data = await res.json();
            if (!res.ok) {
              setError(data.error ?? "Chyba při vyhodnocení BOM.");
              return;
            }

            setItems(data.items as ResultItem[]);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Network error");
          } finally {
            setLoading(false);
          }
        }}
      />

      {loading && (
        <div className="rounded-2xl bg-white p-6 ring-1 ring-black/10">
          <p className="text-sm text-black/60">Vyhodnocuji…</p>
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-white p-6 ring-1 ring-red-200">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {items && (
        <section className="rounded-2xl bg-white p-6 ring-1 ring-black/10 space-y-4">
          <h2 className="text-lg font-semibold text-black/80">Výsledek</h2>

          <div className="overflow-auto rounded-xl ring-1 ring-black/10">
            <table className="min-w-full text-sm">
              <thead className="bg-black/5">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">PN</th>
                  <th className="px-3 py-2 text-left font-medium">Požad.</th>
                  <th className="px-3 py-2 text-left font-medium">Skladem</th>
                  <th className="px-3 py-2 text-left font-medium">Objed.</th>
                  <th className="px-3 py-2 text-left font-medium">Feeder</th>
                  <th className="px-3 py-2 text-left font-medium">Stav</th>
                  <th className="px-3 py-2 text-left font-medium">
                    Chybí teď
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    Doobjednat
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    Dop. objednat
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr
                    key={r.partNumber}
                    className={`border-t ${r.status === "ORDER" ? "bg-micro-error/50" : ""}`}>
                    <td className="px-3 py-2 font-medium text-black/80">
                      {r.partNumber}
                      {!r.knownPart && (
                        <span className="ml-2 text-xs text-black/50">
                          (nové)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-black/70">{r.qtyRequired}</td>
                    <td className="px-3 py-2 text-black/70">{r.onHand}</td>
                    <td className="px-3 py-2 text-black/70">{r.onOrder}</td>
                    <td className="px-3 py-2 text-black/70">
                      {r.feederNos.length ? r.feederNos.join(", ") : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-3 py-2 font-semibold text-black">{r.shortageNow}</td>
                    <td className="px-3 py-2 text-black/70">
                      {r.shortageFuture}
                    </td>
                    <td className="px-3 py-2 text-black/70">{r.orderQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}