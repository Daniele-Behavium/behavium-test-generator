"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const voci = [
  { href: "/", label: "Nuovo test" },
  { href: "/storico", label: "Storico" },
  { href: "/regole", label: "Regole apprese" },
  { href: "/catalogo", label: "Catalogo" },
];

export default function Nav() {
  const p = usePathname();
  if (p.startsWith("/login")) return null;
  return (
    <nav className="hidden items-center gap-1 sm:flex">
      {voci.map((v) => {
        const attivo = v.href === "/" ? p === "/" : p.startsWith(v.href);
        return (
          <Link
            key={v.href}
            href={v.href}
            className={`rounded-[3px] px-2.5 py-1.5 text-[13px] transition-colors ${attivo ? "bg-n-800 text-white" : "text-n-200 hover:text-white"}`}
          >
            {v.label}
          </Link>
        );
      })}
    </nav>
  );
}
