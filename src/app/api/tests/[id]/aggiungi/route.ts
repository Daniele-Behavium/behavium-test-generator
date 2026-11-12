import { gestisci } from "@/lib/api";
import { getTest } from "@/lib/db";
import { generaItems } from "@/lib/generatore";
import { nuovoRef, scenarioDaTest } from "@/lib/modifica-test";
import { salvaModifica } from "@/lib/salva-modifica";
import type { CategoriaEmail, PianoItem, TipoTrappola } from "@/lib/types";

export const maxDuration = 300;
type Ctx = { params: Promise<{ id: string }> };

interface Richiesta {
  idea: string;
  sottoDimensioni: string[];
  trappola: TipoTrappola;
  // in-basket
  ritardo?: number;
  categoria?: CategoriaEmail;
  critica?: boolean;
  // situazionale
  blocco?: string;
  rispostaAScelta?: boolean;
  conOutputAI?: boolean;
}

/** Fa scrivere all'AI un elemento nuovo (email o domanda) e lo aggiunge al test. */
export const POST = gestisci(async (req: Request, ctx: Ctx) => {
  const id = (await ctx.params).id;
  const r = (await req.json()) as Richiesta;
  if (!r.sottoDimensioni?.length) throw new Error("Scegli almeno una sotto-dimensione");
  const rec = await getTest(id);
  if (!rec) throw new Error("Test non trovato");
  const t = structuredClone(rec.test);
  const ref = nuovoRef(t);
  const inBasket = t.tipo === "inBasket";
  if (!inBasket && !t.blocchi.some((b) => b.titolo === r.blocco)) throw new Error("Blocco non trovato");

  const scenario = scenarioDaTest(t);
  const voce: PianoItem = inBasket
    ? {
        ref,
        sottoDimensioni: r.sottoDimensioni,
        categoria: r.categoria ?? "other",
        critica: !!r.critica,
        trappola: r.trappola ?? "nessuna",
        ideaTrappola: "",
        mittente: "(scegli tu un personaggio coerente)",
        ritardo: Math.round(r.ritardo ?? 0),
        sintesi: r.idea || "(decidi tu una situazione coerente con lo scenario)",
        motivazione: "",
      }
    : {
        ref,
        blocco: r.blocco,
        sottoDimensioni: r.sottoDimensioni,
        rispostaAScelta: r.rispostaAScelta ?? true,
        conOutputAI: !!r.conOutputAI,
        trappola: r.trappola ?? "nessuna",
        ideaTrappola: "",
        sintesi: r.idea || "(decidi tu una situazione coerente con lo scenario)",
        motivazione: "",
      };
  scenario.piano.push(voce);
  const nota = `${ref} è un elemento NUOVO aggiunto dal team dopo la generazione. Deve integrarsi con gli altri elementi senza ripeterne le situazioni.${r.idea ? ` Indicazione del team: ${r.idea}` : ""}`;
  const { items, costo } = await generaItems(rec.input, rec.analisi, scenario, [ref], nota);
  const nuovo = items[0];
  if (!nuovo) throw new Error("L'AI non ha prodotto l'elemento richiesto");

  const problemi = await salvaModifica(id, { tipo: "aggiungi", item: nuovo, blocco: r.blocco }, costo);
  return { item: nuovo, problemi };
});
