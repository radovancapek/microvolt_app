"use client";

import { useMemo, useState } from "react";
import { PillButton } from "@/components/ui";

type PreviewRow = Record<string, string>;

type ConfirmItem = {
  partNumber: string;
  qty: number;
  description?: string;
};

function normalizeKey(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[()]/g, " ")
    .replace(/[.:]/g, "") // remove punctuation like ":" "."
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function guessColumn(headers: string[], kind: "pn" | "qty" | "desc" | "so") {
  const norm = headers.map((h) => ({
    raw: h,
    key: normalizeKey(h),
  }));

  // Přesně podle tvého souboru (CZ)
  const candidatesPnCz = ["vyr c", "vyrobni c", "vyrobni cislo"];
  const candidatesDescCz = ["popis"];
  const candidatesQtyCz = ["objednany pocet", "objednano", "pocet", "mnozstvi"];
  const candidatesSoCz = [
    "c prodejni objednavky",
    "cislo prodejni objednavky",
    "cislo objednavky",
    "c objednavky",
  ];

  // Mouser/EN fallback
  const candidatesPnEn = [
    "mfr no",
    "mfr part number",
    "manufacturer part number",
    "mpn",
  ];
  const candidatesQtyEn = ["order qty", "quantity", "qty"];
  const candidatesDescEn = ["desc", "description", "item description"];
  const candidatesSoEn = ["sales order no", "sales order", "order no", "order number"];

  const candidates =
    kind === "pn"
      ? [...candidatesPnCz, ...candidatesPnEn]
      : kind === "qty"
        ? [...candidatesQtyCz, ...candidatesQtyEn]
        : kind === "desc"
          ? [...candidatesDescCz, ...candidatesDescEn]
          : [...candidatesSoCz, ...candidatesSoEn];

  // 1) exact match (nejvyšší priorita)
  for (const c of candidates) {
    const found = norm.find((x) => x.key === c);
    if (found) return found.raw;
  }

  // 2) contains match (fallback)
  for (const c of candidates) {
    const found = norm.find((x) => x.key.includes(c));
    if (found) return found.raw;
  }

  return "";
}

function normalizePartNumber(pn: string) {
  return pn.trim().toUpperCase();
}

function parseQty(q: string) {
  const n = Number(String(q).replace(",", ".").trim());
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function normalizeText(value: unknown) {
  const s = String(value ?? "").trim();
  return s.length ? s : "";
}

export function MouserFilePreviewMapper({
  title,
  onConfirm,
}: {
  title: string;
  onConfirm: (items: ConfirmItem[], meta: {
    fileName: string;
    salesOrderNo?: string;
  }) => void;
}) {
  const [fileName, setFileName] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<PreviewRow[]>([]);

  const [pnCol, setPnCol] = useState<string>("");
  const [qtyCol, setQtyCol] = useState<string>("");
  const [descCol, setDescCol] = useState<string>("");
  const [soCol, setSoCol] = useState<string>("");

  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const previewRows = useMemo(() => rows.slice(0, 20), [rows]);

  async function handleFile(file: File) {
    setError("");
    setLoading(true);
    setFileName(file.name);

    setHeaders([]);
    setRows([]);

    setPnCol("");
    setQtyCol("");
    setDescCol("");
    setSoCol("");

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/mouser/preview", {
        method: "POST",
        body: form,
      });

      const text = await res.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `Preview API nevrátilo JSON (status ${res.status}): ${text.slice(
            0,
            200
          )}`
        );
      }

      if (!res.ok) {
        const d = data as { error?: string };
        throw new Error(d.error ?? `Chyba preview API (status ${res.status})`);
      }

      const d = data as {
        fileName: string;
        headers: string[];
        rows: PreviewRow[];
      };

      setHeaders(d.headers);
      setRows(d.rows);

      setPnCol(guessColumn(d.headers, "pn"));
      setQtyCol(guessColumn(d.headers, "qty"));
      setDescCol(guessColumn(d.headers, "desc"));
      setSoCol(guessColumn(d.headers, "so"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nelze načíst soubor.");
    } finally {
      setLoading(false);
    }
  }

  function confirm() {
    if (!pnCol || !qtyCol) {
      setError("Vyber sloupec pro Mfr. Part Number (Mfr. No:) a Order Qty.");
      return;
    }

    const mapQty = new Map<string, number>();
    const mapDesc = new Map<string, string>();
    let salesOrderNo: string | undefined;

    for (const r of rows) {
      const pn = normalizePartNumber(String(r[pnCol] ?? ""));
      const qty = parseQty(String(r[qtyCol] ?? ""));
      if (!pn || qty <= 0) continue;

      mapQty.set(pn, (mapQty.get(pn) ?? 0) + qty);

      if (descCol) {
        const desc = normalizeText(r[descCol]);
        if (desc) {
          const prev = mapDesc.get(pn);
          if (!prev || desc.length > prev.length) {
            mapDesc.set(pn, desc);
          }
        }
      }

      if (!salesOrderNo && soCol) {
        const so = normalizeText(r[soCol]);
        if (so) salesOrderNo = so;
      }
    }

    const items: ConfirmItem[] = Array.from(mapQty.entries()).map(
      ([partNumber, qty]) => ({
        partNumber,
        qty,
        description: mapDesc.get(partNumber),
      })
    );

    if (items.length === 0) {
      setError("Nenašel jsem žádné platné řádky (PN + qty > 0).");
      return;
    }

    onConfirm(items, { fileName, salesOrderNo });
  }

  return (
    <div className="rounded-2xl bg-white p-6 ring-1 ring-black/10 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-black/80">{title}</h2>
        </div>

        <label className="cursor-pointer">
          <input
            type="file"
            className="hidden"
            accept=".xls,.xlsx"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <span className="inline-flex rounded-full bg-micro-lime px-4 py-2 text-sm font-medium text-black">
            Vybrat soubor
          </span>
        </label>
      </div>

      {fileName && (
        <p className="text-sm text-black/60">
          Soubor: <span className="font-medium">{fileName}</span>
        </p>
      )}

      {loading && <p className="text-sm text-black/60">Načítám preview…</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}

      {headers.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Sloupec: Part number (MPN)
            <select
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={pnCol}
              onChange={(e) => setPnCol(e.target.value)}
            >
              <option value="">— vyber —</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            Sloupec: Quantity
            <select
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={qtyCol}
              onChange={(e) => setQtyCol(e.target.value)}
            >
              <option value="">— vyber —</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            Sloupec: Description (volitelné)
            <select
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={descCol}
              onChange={(e) => setDescCol(e.target.value)}
            >
              <option value="">— nepoužít —</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            Sloupec: Sales Order No. (volitelné, pro kontrolu duplicit)
            <select
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={soCol}
              onChange={(e) => setSoCol(e.target.value)}
            >
              <option value="">— nepoužít —</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {previewRows.length > 0 && (
        <div className="overflow-auto rounded-xl ring-1 ring-black/10">
          <table className="min-w-full text-sm">
            <thead className="bg-black/5">
              <tr>
                {headers.slice(0, 16).map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((r, i) => (
                <tr key={i} className="border-t">
                  {headers.slice(0, 16).map((h) => (
                    <td key={h} className="px-3 py-2 text-black/70">
                      {String(r[h] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <PillButton onClick={confirm} disabled={!rows.length || loading}>
          Potvrdit mapování
        </PillButton>
        <span className="text-sm text-black/60">Řádků načteno: {rows.length}</span>
      </div>
    </div>
  );
}