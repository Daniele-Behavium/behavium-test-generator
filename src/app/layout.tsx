import type { Metadata } from "next";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import { cookies } from "next/headers";
import { COOKIE_NOME } from "@/lib/auth";
import Nav from "@/components/Nav";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Behavium · Generatore test",
  description: "Generazione assistita di test in-basket e situazionali",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const c = (await cookies()).get(COOKIE_NOME)?.value;
  const nome = c ? decodeURIComponent(c) : "";
  return (
    <html lang="it">
      <body className="min-h-screen">
        <header className="sticky top-0 z-20 bg-n-950 text-white">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="relative grid h-8 w-8 place-items-center rounded-[3px] bg-a-500 text-[13px] font-semibold">
                Bh
                <span className="absolute top-0.5 left-1 font-mono text-[7px] opacity-80">01</span>
              </span>
              <span className="text-sm font-medium tracking-tight">
                Behavium <span className="text-n-300">· Generatore test</span>
              </span>
            </Link>
            <Nav />
            {nome && <span className="ml-auto font-mono text-xs text-n-300">{nome}</span>}
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
