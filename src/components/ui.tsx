"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getSottoDimensione } from "@/lib/catalog";

export function Md({ children }: { children: string }) {
  return (
    <div className="prose-bh">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children || ""}</ReactMarkdown>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-[4px] border border-n-100 bg-white p-0.5">
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-[3px] px-3 py-1.5 text-sm transition-colors ${value === o.value ? "bg-n-900 text-white" : "text-n-600 hover:bg-n-25"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SubChip({ id }: { id: string }) {
  const s = getSottoDimensione(id);
  const ai = s?.dim.tipoSkill === "ai";
  return (
    <span className={`chip ${ai ? "bg-a-50 text-a-700 ring-1 ring-a-100" : "bg-info-50 text-info ring-1 ring-[#d3e3ef]"}`} title={s ? `${s.dim.nome} › ${s.sub.declaratoria}` : id}>
      {s ? s.sub.nome : id}
    </span>
  );
}

export function Badge({ children, tono = "neutro" }: { children: React.ReactNode; tono?: "neutro" | "ok" | "warn" | "err" | "info" | "dark" }) {
  const c = {
    neutro: "bg-n-50 text-n-600",
    ok: "bg-a-50 text-a-700",
    warn: "bg-warn-50 text-warn",
    err: "bg-err-50 text-err",
    info: "bg-info-50 text-info",
    dark: "bg-n-900 text-white",
  }[tono];
  return <span className={`chip ${c}`}>{children}</span>;
}

export async function api<T = unknown>(url: string, body?: unknown, method?: string): Promise<T> {
  const r = await fetch(url, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.errore || `Errore ${r.status}`);
  return j as T;
}

export const euro = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;
