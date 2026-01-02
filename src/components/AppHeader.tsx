import Link from "next/link";

export function AppHeader() {
  return (
    <header className="bg-micro-olive text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-sm font-semibold tracking-wide">
          MicroVolt • Sklad
        </Link>

        <nav className="flex items-center gap-6 text-sm text-white/80">
          <Link className="hover:text-white" href="/bom">
            BOM kontrola
          </Link>
          <Link className="hover:text-white" href="/mouser-import">
            Import Mouser
          </Link>
        </nav>
      </div>
    </header>
  );
}