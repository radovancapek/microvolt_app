import "./globals.css";
import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";

export const metadata: Metadata = {
  title: "Sklad monitor",
  description: "Monitorování skladových zásob",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      <body className="bg-micro-paper text-black/80">
        <AppHeader />
        {children}
      </body>
    </html>
  );
}