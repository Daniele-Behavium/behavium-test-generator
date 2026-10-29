import { gestisci } from "@/lib/api";
import { aggiornaTest, getTest } from "@/lib/db";
import { generaItems } from "@/lib/generatore";
import { validaTest } from "@/lib/regole";
import type { DomandaGenerata, EmailGenerata, Scenario, TestGenerato } from "@/lib/types";

export const maxDuration = 300;
type Ctx = { params: Promise<{ id: string }> };

/** Ricostruisce lo scenario (piano incluso) a partire dal test salvato. */
function scenarioDaTest(t: TestGenerato): Scenario {
  const piano =
    t.tipo === "inBasket"
      ? t.email.map((e) => ({
          ref: e.ref,
          sottoDimensioni: e.sottoDimensioni,
          categoria: e.categoria,
          critica: e.critica,
          trappola: e.tipoTrappola,
          ideaTrappola: e.descrizioneTrappola,
          mittente: e.mittente,
          ritardo: e.ritardo,
          sintesi: `${e.oggetto}. ${e.corpo.slice(0, 200)}`,
          motivazione: e.motivazione,
        }))
      : t.blocchi.flatMap((b) =>
          b.domande.map((d) => ({
            ref: d.ref,
            blocco: b.titolo,
            sottoDimensioni: d.sottoDimensioni,
            rispostaAScelta: d.rispostaAScelta,
            conOutputAI: !!d.outputAISimulato,
            trappola: d.tipoTrappola,
            ideaTrappola: d.descrizioneTrappola,
            sintesi: d.testo.slice(0, 220),
            motivazione: d.motivazione,
          }))
        );
  return {
    nome: t.nome,
    settoreScenario: t.settoreScenario,
    istruzioni: t.istruzioni,
    introduzioneTecnica: t.introduzioneTecnica,
    personaggi: t.personaggi,
    blocchi: t.blocchi.map((b) => ({ titolo: b.titolo })),
    piano,
  };
}

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
  const problemi = validaTest(t);
  await aggiornaTest(id, { test: t, problemi, costo: Number(rec.costo) + costo });
  return { item: nuovo, problemi };
});
