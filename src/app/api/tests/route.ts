import { gestisci, nomeUtente } from "@/lib/api";
import { assembla } from "@/lib/assembla";
import { listaTest, salvaTest } from "@/lib/db";
import { validaTest } from "@/lib/regole";
import { catalogo } from "@/lib/catalog";

export const GET = gestisci(async () => listaTest());

export const POST = gestisci(async (req: Request) => {
  const { input, analisi, scenario, items, modello, costo } = await req.json();
  const test = assembla(input, analisi, scenario, items);
  const problemi = validaTest(test);
  const id = await salvaTest({
    autore: await nomeUtente(),
    stato: "bozza",
    input: { ...input, durata: test.durata, seniority: test.seniority },
    analisi,
    test,
    problemi,
    modello,
    costo,
    catalogo_versione: catalogo.versione,
  });
  return { id, problemi };
});
