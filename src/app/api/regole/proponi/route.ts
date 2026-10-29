import { gestisci, nomeUtente } from "@/lib/api";
import { aggiungiRegole, feedbackDaElaborare, getTest, listaRegole, segnaElaborati } from "@/lib/db";
import { chiamaAI } from "@/lib/openrouter";
import { promptRegole, SYSTEM_BASE } from "@/lib/prompts";
import { schemaRegoleProposte } from "@/lib/schemi";
import type { RecordTest } from "@/lib/types";

export const maxDuration = 300;

function contestoItem(t: RecordTest | null, ref: string | null): string {
  if (!t) return "";
  const base = `test "${t.test.nome}" (${t.test.tipo}, ${t.test.ruoloTarget}, ${t.test.seniority})`;
  if (!ref) return `${base}, feedback sul test intero`;
  const e = t.test.email.find((x) => x.ref === ref);
  if (e) return `${base}, email ${ref} da ${e.mittente} "${e.oggetto}", trappola ${e.tipoTrappola}, sotto-dimensioni ${e.sottoDimensioni.join(", ")}`;
  const d = t.test.blocchi.flatMap((b) => b.domande).find((x) => x.ref === ref);
  if (d) return `${base}, domanda ${ref} (${d.rispostaAScelta ? "a scelta" : "aperta"}): "${d.testo.slice(0, 200)}", sotto-dimensioni ${d.sottoDimensioni.join(", ")}`;
  return base;
}

export const POST = gestisci(async () => {
  const fb = await feedbackDaElaborare();
  if (!fb.length) return { proposte: 0, messaggio: "Nessun feedback nuovo con commento da elaborare." };
  const testIds = Array.from(new Set(fb.map((f) => f.test_id)));
  const tests = new Map(await Promise.all(testIds.map(async (id) => [id, await getTest(id)] as const)));
  const esistenti = (await listaRegole()).filter((r) => r.stato !== "scartata").map((r) => r.testo);
  const r = await chiamaAI<{ regole: { testo: string; ambito: "tutti" | "inBasket" | "situational"; feedbackIds: string[] }[] }>({
    system: SYSTEM_BASE,
    user: promptRegole(
      fb.map((f) => ({ id: f.id, esito: f.esito, commento: f.commento, contesto: contestoItem(tests.get(f.test_id) ?? null, f.item_ref) })),
      esistenti
    ),
    schemaName: "regole",
    schema: schemaRegoleProposte,
    maxTokens: 4000,
    temperature: 0.2,
  });
  const autore = await nomeUtente();
  await aggiungiRegole(r.dati.regole.map((x) => ({ testo: x.testo, ambito: x.ambito, stato: "proposta" as const, origine: x.feedbackIds.join(","), autore })));
  await segnaElaborati(fb.map((f) => f.id));
  return { proposte: r.dati.regole.length, costo: r.costo };
});
