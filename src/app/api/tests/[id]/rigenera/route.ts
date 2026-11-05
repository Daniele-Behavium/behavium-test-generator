import { gestisci } from "@/lib/api";
import { getTest } from "@/lib/db";
import { generaItems } from "@/lib/generatore";
import { scenarioDaTest } from "@/lib/modifica-test";
import { salvaModifica } from "@/lib/salva-modifica";
import type { DomandaGenerata, EmailGenerata } from "@/lib/types";

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
  const t = structuredClone(rec.test);
  if (t.tipo === "inBasket") t.email = t.email.map((e) => (e.ref === ref ? (nuovo as EmailGenerata) : e));
  else
    t.blocchi = t.blocchi.map((b) => ({
      ...b,
      domande: b.domande.map((d) => (d.ref === ref ? { ...(nuovo as DomandaGenerata), blocco: b.titolo } : d)),
    }));
  const problemi = await salvaModifica(rec, t, costo);
  return { item: nuovo, problemi };
});
