import { catalogo } from "@/lib/catalog";

export default function Catalogo() {
  return (
    <div className="max-w-4xl">
      <p className="eyebrow">Catalogo · versione {catalogo.versione}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Dimensioni e sotto-dimensioni</h1>
      {catalogo.note && <p className="mt-3 rounded-[4px] border border-warn/30 bg-warn-50 px-4 py-3 text-sm text-n-800">{catalogo.note}</p>}
      <div className="mt-6 space-y-6">
        {catalogo.dimensioni.map((d) => (
          <section key={d.id} className="card">
            <div className="border-b border-n-50 px-5 py-4">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">{d.nome}</h2>
                <span className={`chip ${d.tipoSkill === "ai" ? "bg-a-50 text-a-700" : "bg-info-50 text-info"}`}>{d.tipoSkill === "ai" ? "AI skill" : "Soft skill"}</span>
                <span className="ml-auto font-mono text-[11px] text-n-300">{d.id}</span>
              </div>
              <p className="mt-1 text-sm text-n-600">{d.declaratoria}</p>
            </div>
            <ul className="divide-y divide-n-50">
              {d.sottoDimensioni.map((s) => (
                <li key={s.id} className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">{s.nome}</h3>
                    {s.provvisorio && <span className="chip bg-warn-50 text-warn">provvisorio</span>}
                  </div>
                  <p className="mt-1 text-sm text-n-600">{s.declaratoria}</p>
                  <ol className="mt-2 grid gap-1 text-xs text-n-600">
                    {(["1", "2", "3", "4", "5"] as const).map((k) => (
                      <li key={k} className="flex gap-2">
                        <span className="font-mono text-n-300">{k}</span>
                        <span>{s.griglia[k]}</span>
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
