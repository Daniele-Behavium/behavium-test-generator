import { gestisci } from "@/lib/api";
import { getTest } from "@/lib/db";
import { generaItems } from "@/lib/generatore";
import { scenarioDaTest } from "@/lib/modifica-test";
import { salvaModifica } from "@/lib/salva-modifica";

export const maxDuration = 300;
type Ctx = { params: Promise<{ id: string }> };

export const POST = gestisci(async (req: Request, ctx: Ctx) => {
  const id = (await ctx.params).id;
  const { ref, note } = await req.json();
  const rec = await getTest(id);
  if (!rec) throw new Error("Test non trovato");
  const scenario = scenarioDaTest(rec.test);
  const nota = `Stai RISCRIVENDO l'elemento ${ref}. La versione precedente è stata giudicata da rivedere dal team. Mantieni coerenza con lo scenario. Feedback del team:\n${note || "(nessun commento: migliorane qualità e aderenza alle sotto-dimensioni)"}`;
  const { items, costo } = await generaItems(rec.input, rec.analisi, scenario, [ref], nota);
  const nuovo = items[0];
  if (!nuovo) throw new Error("La rigenerazione non ha prodotto l'elemento richiesto");
  const problemi = await salvaModifica(id, { tipo: "sostituisci", ref, item: nuovo }, costo);
  return { item: nuovo, problemi };
});
