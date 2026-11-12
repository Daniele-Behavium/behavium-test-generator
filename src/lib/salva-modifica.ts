import "server-only";
import { aggiornaTest, getTest } from "./db";
import { validaTest } from "./regole";
import { applicaOperazione, normalizzaTest, type Operazione } from "./modifica-test";

/**
 * Applica una modifica alla versione più recente del test, ricalcola i controlli e somma
 * l'eventuale costo AI alle modifiche. Il test viene riletto subito prima di salvare:
 * così una rigenerazione lunga non sovrascrive le modifiche fatte nel frattempo.
 */
export async function salvaModifica(id: string, op: Operazione, costo = 0) {
  const rec = await getTest(id);
  if (!rec) throw new Error("Test non trovato");
  const t = normalizzaTest(applicaOperazione(rec.test, op));
  const problemi = validaTest(t);
  if (!costo) {
    await aggiornaTest(id, { test: t, problemi });
    return problemi;
  }
  try {
    await aggiornaTest(id, { test: t, problemi, costo_modifiche: Number(rec.costo_modifiche ?? 0) + costo });
  } catch (e) {
    // database senza la colonna costo_modifiche: il costo si somma a quello totale
    if (!String(e).includes("costo_modifiche")) throw e;
    await aggiornaTest(id, { test: t, problemi, costo: Number(rec.costo) + costo });
  }
  return problemi;
}
