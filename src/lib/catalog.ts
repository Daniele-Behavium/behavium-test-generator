import raw from "@/catalog/dimensioni.json";
import type { Catalogo, Dimensione, SottoDimensione } from "./types";

export const catalogo = raw as Catalogo;

const dimById = new Map<string, Dimensione>();
const subById = new Map<string, { sub: SottoDimensione; dim: Dimensione }>();
for (const d of catalogo.dimensioni) {
  dimById.set(d.id, d);
  for (const s of d.sottoDimensioni) subById.set(s.id, { sub: s, dim: d });
}

export const getDimensione = (id: string) => dimById.get(id);
export const getSottoDimensione = (id: string) => subById.get(id);
export const dimensioneDi = (subId: string) => subById.get(subId)?.dim.id;

/** Catalogo in formato testo compatto per i prompt. */
export function catalogoPerPrompt(soloSub?: string[]): string {
  const filtro = soloSub ? new Set(soloSub) : null;
  return catalogo.dimensioni
    .map((d) => {
      const subs = d.sottoDimensioni.filter((s) => !filtro || filtro.has(s.id));
      if (filtro && subs.length === 0) return "";
      const righe = subs
        .map(
          (s) =>
            `  - [${s.id}] ${s.nome}: ${s.declaratoria}\n    Griglia: ` +
            (["1", "2", "3", "4", "5"] as const).map((k) => `${k}=${s.griglia[k]}`).join(" | ")
        )
        .join("\n");
      return `DIMENSIONE [${d.id}] ${d.nome} (${d.tipoSkill === "ai" ? "AI skill" : "Soft skill"}): ${d.declaratoria}\n${righe}`;
    })
    .filter(Boolean)
    .join("\n\n");
}
