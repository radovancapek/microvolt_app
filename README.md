# MicroVolt Sklad Monitor

Interní webová aplikace pro monitorování skladových zásob a import souborů:
- **BOM kontrola** (zákaznický BOM → vyhodnocení dostupnosti + doporučení)
- **Mouser import objednávky** (Excel 97–2003 `.xls` i `.xlsx` bez ruční konverze mimo aplikaci)

Projekt je postavený tak, aby šel rychle používat ve výrobě (čitelné stavy, minimální klikání, audit importů).


## Požadavky
- Node.js 20+
- Docker Desktop (Windows 11) / Docker Engine (Linux)
- (Windows) doporučeno používat `npm.cmd` / `npx.cmd` v PowerShellu, pokud je blokované spouštění `.ps1`

---

## Rychlý start (lokálně)

# 1) Instalace závislostí
npm.cmd install

# 2) Docker služby (DB + konvertor) + složka pro konverze
New-Item -ItemType Directory -Force tmp-convert
docker compose up -d

# 3) Environment (.env v rootu) – uprav/ověř připojení k DB
# DATABASE_URL="postgresql://sklad:skladpass@localhost:5432/sklad?schema=public"

# 4) Migrace + generate
npx prisma migrate dev
npx prisma generate

# 5) Seed testovacích dat
npx prisma db seed

# 6) Spuštění aplikace
npm.cmd run dev

---

## Co aplikace umí

### 1) Kontrola BOM vs sklad (`/bom`)
- Upload BOM souboru (**CSV/XLSX**), zákazníci mají variabilní sloupce → uživatel **namapuje sloupce**:
  - `Part number`
  - `Quantity`
- Vyhodnocení proti skladu i objednávkám (on-hand + on-order):
  - **OK**: stačí ze skladu
  - **ČEKÁ SE**: ze skladu to nestačí, ale po doručení objednaného to stačí
  - **OBJEDNAT**: nestačí ani sklad + objednáno
- Zobrazení stavu „nasazeno“:
  - pokud je součástka přiřazena k feederu, zobrazí se **číslo podavače**
  - výjimečně může mít jedna součástka více feederů
- Podpora nákupních pravidel:
  - **MOQ** (`moq`)
  - **orderMultiple** (`orderMultiple`)
  - tabulka ukazuje:
    - `Doobjednat` (kolik reálně chybí)
    - `Dop. objednat` (zaokrouhleno dle MOQ/násobků)

### 2) Import Mouser objednávky (`/mouser-import`)
- Upload exportu z Mouseru:
  - **`.xls` (Excel 97–2003)** → server soubor automaticky převede na `.xlsx` pomocí **LibreOffice** v Dockeru
  - **`.xlsx`** → čte se přímo
- Preview + mapování sloupců (server-side):
  - Part number (MPN): typicky `Mfr. No:`
  - Quantity: typicky `Order Qty.`
  - volitelně:
    - `Description` (plní `Part.description`)
    - `Sales Order No.` (pro detekci duplicity importu)
- Import do DB:
  - existující součástka → `inventory.onOrder += qty`
  - nová součástka → vytvoří `Part` + `Inventory(onOrder=qty)`
  - `description`:
    - u nových parts se uloží
    - u existujících se doplní jen když je v DB prázdná (nepřepisuje)
- Audit importů:
  - `PurchaseImportBatch` (1 import)
  - `PurchaseImportLine` (řádky importu)
- Ochrana proti dvojitému importu stejné objednávky:
  - `PurchaseImportBatch.salesOrderNo` je **unikátní** (pokud je vyplněno)
  - při duplicitě endpoint vrací **409 Conflict**

---

## Tech stack (aktuální)
- **Next.js 16** (App Router) + **React** + **TypeScript**
- **Tailwind CSS v4** (MicroVolt tokeny `micro.*`)
- **PostgreSQL** (Docker)
- **Prisma 7.x** + **Driver Adapter pro Postgres**
  - `@prisma/adapter-pg`
  - `pg`
- **LibreOffice** v Dockeru (konverze `.xls → .xlsx`)
- **exceljs** (server-side čtení Excelů / preview)
- **papaparse** (CSV parsing v klientu pro BOM)

---

Tailwind (v4)
Aby fungovaly tokeny micro.*, src/app/globals.css musí explicitně ukazovat na config:
@config "../../tailwind.config.js";
@tailwind base;
@tailwind components;
@tailwind utilities;

Pokud PowerShell blokuje npm.ps1/npx.ps1, používej npm.cmd / npx.cmd.