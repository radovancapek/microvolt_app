import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import ExcelJS from "exceljs";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs"; // potřebujeme fs + child_process

type PreviewRow = Record<string, string>;

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return value.toISOString();

  if (typeof value === "object" && "formula" in value) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v: any = value;
    return v.result === undefined || v.result === null ? "" : String(v.result);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyVal: any = value;
  if (anyVal?.text) return String(anyVal.text);

  return String(value);
}

async function readXlsxPreview(filePath: string, maxRows: number) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] as PreviewRow[] };

  const colCount = sheet.columnCount ?? 0;
  if (colCount <= 0) return { headers: [], rows: [] as PreviewRow[] };

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  for (let c = 1; c <= colCount; c += 1) {
    const h = cellToString(headerRow.getCell(c).value).trim();
    headers.push(h || `COL_${c}`);
  }

  const rows: PreviewRow[] = [];
  for (let r = 2; r <= sheet.rowCount && rows.length < maxRows; r += 1) {
    const row = sheet.getRow(r);

    let hasAny = false;
    for (let c = 1; c <= colCount; c += 1) {
      if (cellToString(row.getCell(c).value).trim() !== "") {
        hasAny = true;
        break;
      }
    }
    if (!hasAny) continue;

    const obj: PreviewRow = {};
    for (let c = 1; c <= colCount; c += 1) {
      obj[headers[c - 1]] = cellToString(row.getCell(c).value);
    }
    rows.push(obj);
  }

  return { headers, rows };
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const originalName = file.name;
  const ext = path.extname(originalName).toLowerCase(); // .xls / .xlsx

  if (ext !== ".xls" && ext !== ".xlsx") {
    return NextResponse.json(
      { error: "Only .xls or .xlsx is supported for Mouser preview." },
      { status: 400 }
    );
  }

  const id = crypto.randomBytes(8).toString("hex");
  const workDir = path.join(process.cwd(), "tmp-convert");
  await fs.mkdir(workDir, { recursive: true });

  const inputPath = path.join(workDir, `${id}${ext}`);
  const outPath = path.join(workDir, `${id}.xlsx`);

  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(inputPath, buf);

  try {
    if (ext === ".xls") {
      // run conversion inside converter container
      // writes converted xlsx into /work (mapped to ./tmp-convert)
      await execFileAsync("docker", [
        "exec",
        "sklad_converter",
        "soffice",
        "--headless",
        "--nologo",
        "--nolockcheck",
        "--nodefault",
        "--norestore",
        "--convert-to",
        "xlsx",
        "--outdir",
        "/work",
        `/work/${id}.xls`,
      ]);
    } else {
      // already xlsx
      await fs.copyFile(inputPath, outPath);
    }

    const preview = await readXlsxPreview(outPath, 30);

    return NextResponse.json({
      fileName: originalName,
      headers: preview.headers,
      rows: preview.rows,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Conversion/preview failed" },
      { status: 500 }
    );
  } finally {
    // optional cleanup (nechávám soubory pro debug; později smažeme)
    // await fs.rm(inputPath, { force: true });
    // await fs.rm(outPath, { force: true });
  }
}