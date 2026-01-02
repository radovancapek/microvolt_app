"use client";

import ExcelJS from "exceljs";
import Papa from "papaparse";
import { useMemo, useState } from "react";
import { PillButton } from "@/components/ui";

type PreviewRow = Record<string, string>;

function normalizeHeader(h: string) {
    return h.trim();
}

function guessColumn(headers: string[], kind: "pn" | "qty") {
    const norm = headers.map((h) => ({
        raw: h,
        key: h
            .toLowerCase()
            .replace(/\s+/g, " ")
            .replace(/[_\-]+/g, " ")
            .trim(),
    }));

    const candidatesPn = [
        "part number",
        "part",
        "pn",
        "p/n",
        "mpn",
        "mfr part number",
        "manufacturer part number",
        "item",
        "code",
        "material",
        "soucastka",
        "součástka",
    ];

    const candidatesQty = [
        "qty",
        "quantity",
        "počet",
        "pocet",
        "ks",
        "pcs",
        "amount",
        "required qty",
        "req qty",
    ];

    const candidates = kind === "pn" ? candidatesPn : candidatesQty;

    for (const c of candidates) {
        const found = norm.find((x) => x.key === c);
        if (found) return found.raw;
    }

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

function excelCellToString(value: ExcelJS.CellValue): string {
    if (value === null || value === undefined) return "";

    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";

    // Date
    if (value instanceof Date) return value.toISOString();

    // Formula
    if (typeof value === "object" && "formula" in value) {
        // prefer computed result if present
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const v: any = value;
        const res = v.result;
        return res === undefined || res === null ? "" : String(res);
    }

    // RichText
    if (typeof value === "object" && "richText" in value) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const v: any = value;
        const parts = Array.isArray(v.richText) ? v.richText : [];
        return parts.map((p: { text?: string }) => p.text ?? "").join("");
    }

    // Hyperlink, Error, etc.
    return String(value);
}

async function readExcelFile(file: File): Promise<{
  headers: string[];
  rows: PreviewRow[];
}> {
  const buf = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();

  const xlsx = workbook.xlsx;
  if (!xlsx) {
    throw new Error("Excel loader (workbook.xlsx) není dostupný.");
  }
  await xlsx.load(buf);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { headers: [], rows: [] };
  }

  // Determine column count from sheet dimensions
  // sheet.columnCount is reliable for "used" columns
  const colCount = sheet.columnCount ?? 0;
  if (colCount <= 0) {
    return { headers: [], rows: [] };
  }

  // Header row = row 1, read each header cell via getCell
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  for (let c = 1; c <= colCount; c += 1) {
    const header = normalizeHeader(excelCellToString(headerRow.getCell(c).value));
    headers.push(header || `COL_${c}`);
  }

  const rows: PreviewRow[] = [];

  // Data rows: 2..rowCount, read cells via getCell
  for (let r = 2; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);

    // skip fully empty row (check used columns)
    let hasAnyValue = false;
    for (let c = 1; c <= colCount; c += 1) {
      const s = excelCellToString(row.getCell(c).value).trim();
      if (s !== "") {
        hasAnyValue = true;
        break;
      }
    }
    if (!hasAnyValue) continue;

    const obj: PreviewRow = {};
    for (let c = 1; c <= colCount; c += 1) {
      const header = headers[c - 1];
      obj[header] = excelCellToString(row.getCell(c).value);
    }
    rows.push(obj);
  }

  return { headers, rows };
}

function readCsvFile(fileText: string): { headers: string[]; rows: PreviewRow[] } {
    const parsed = Papa.parse<Record<string, string>>(fileText, {
        header: true,
        skipEmptyLines: true,
    });

    if (parsed.errors.length) {
        throw new Error(parsed.errors[0]?.message ?? "CSV parse error");
    }

    const rows = parsed.data ?? [];
    const headers = (parsed.meta.fields ?? []).map(normalizeHeader);

    return { headers, rows };
}

export function FilePreviewMapper({
    title,
    onConfirm,
    maxFileMb = 10,
    maxPreviewRows = 2000,
}: {
    title: string;
    onConfirm: (items: Array<{ partNumber: string; qty: number }>) => void;
    maxFileMb?: number;
    maxPreviewRows?: number;
}) {
    const [fileName, setFileName] = useState<string>("");
    const [headers, setHeaders] = useState<string[]>([]);
    const [rows, setRows] = useState<PreviewRow[]>([]);
    const [pnCol, setPnCol] = useState<string>("");
    const [qtyCol, setQtyCol] = useState<string>("");
    const [error, setError] = useState<string>("");

    const previewRows = useMemo(() => rows.slice(0, 20), [rows]);

    async function handleFile(file: File) {
        setError("");
        setFileName(file.name);
        setHeaders([]);
        setRows([]);
        setPnCol("");
        setQtyCol("");

        const maxBytes = maxFileMb * 1024 * 1024;
        if (file.size > maxBytes) {
            setError(`Soubor je moc velký. Max ${maxFileMb} MB.`);
            return;
        }

        const ext = file.name.split(".").pop()?.toLowerCase();

        try {
            if (ext === "csv") {
                const text = await file.text();
                const out = readCsvFile(text);

                const limitedRows = out.rows.slice(0, maxPreviewRows);
                setHeaders(out.headers);
                setRows(limitedRows);
                setPnCol(guessColumn(out.headers, "pn"));
                setQtyCol(guessColumn(out.headers, "qty"));
                return;
            }

            if (ext === "xlsx" || ext === "xls") {
                const out = await readExcelFile(file);

                const limitedRows = out.rows.slice(0, maxPreviewRows);
                setHeaders(out.headers);
                setRows(limitedRows);
                setPnCol(guessColumn(out.headers, "pn"));
                setQtyCol(guessColumn(out.headers, "qty"));
                return;
            }

            setError("Nepodporovaný typ souboru. Použij XLSX/XLS/CSV.");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Nelze načíst soubor.");
        }
    }

    function confirm() {
        if (!pnCol || !qtyCol) {
            setError("Vyber sloupec pro Part number a Quantity.");
            return;
        }

        const map = new Map<string, number>();

        for (const r of rows) {
            const pn = normalizePartNumber(String(r[pnCol] ?? ""));
            const qty = parseQty(String(r[qtyCol] ?? ""));

            if (!pn || qty <= 0) continue;
            map.set(pn, (map.get(pn) ?? 0) + qty);
        }

        const items = Array.from(map.entries()).map(([partNumber, qty]) => ({
            partNumber,
            qty,
        }));

        if (items.length === 0) {
            setError("Nenašel jsem žádné platné řádky (PN + qty > 0).");
            return;
        }

        onConfirm(items);
    }

    return (
        <div className="rounded-2xl bg-white p-6 ring-1 ring-black/10 space-y-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-black/80">{title}</h2>
                    <p className="mt-1 text-sm text-black/60">
                        Podporováno: XLSX/XLS/CSV. Nejdřív se zobrazí náhled a mapování
                        sloupců. (Limit souboru: {maxFileMb} MB)
                    </p>
                </div>

                <label className="cursor-pointer">
                    <input
                        type="file"
                        className="hidden"
                        accept=".xlsx,.xls,.csv"
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

            {error && <p className="text-sm text-red-700">{error}</p>}

            {headers.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-sm">
                        Sloupec: Part number
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
                </div>
            )}

            {previewRows.length > 0 && (
                <div className="overflow-auto rounded-xl ring-1 ring-black/10">
                    <table className="min-w-full text-sm">
                        <thead className="bg-black/5">
                            <tr>
                                {headers.slice(0, 8).map((h) => (
                                    <th key={h} className="px-3 py-2 text-left font-medium">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {previewRows.map((r, i) => (
                                <tr key={i} className="border-t">
                                    {headers.slice(0, 8).map((h) => (
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
                <PillButton onClick={confirm} disabled={!rows.length}>
                    Potvrdit mapování
                </PillButton>
                <span className="text-sm text-black/60">Řádků načteno: {rows.length}</span>
            </div>
        </div>
    );
}