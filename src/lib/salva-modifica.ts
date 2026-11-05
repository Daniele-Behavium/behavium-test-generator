import "server-only";
import type { RecordTest, TestGenerato } from "./types";
import { aggiornaTest } from "./db";
import { validaTest } from "./regole";
import { normalizzaTest } from "./modifica-test";

/** Salva un test modificato, ricalcola i controlli e somma l'eventuale costo AI alle modifiche. */
export async function salvaModifica(rec: RecordTest, test: TestGenerato, costo = 0) {
  const t = normalizzaTest(test);
  const problemi = validaTest(t);
  if (!costo) {
    await aggiornaTest(rec.id, { test: t, problemi });
    return problemi;
  }
  try {
    await aggiornaTest(rec.id, { test: t, problemi, costo_modifiche: Number(rec.costo_modifiche ?? 0) + costo });
  } catch (e) {
    // database senza la colonna costo_modifiche: il costo si somma a quello totale
    if (!String(e).includes("costo_modifiche")) throw e;
    await aggiornaTest(rec.id, { test: t, problemi, costo: Number(rec.costo) + costo });
  }
  return problemi;
}
