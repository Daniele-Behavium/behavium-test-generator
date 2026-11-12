import { gestisci } from "@/lib/api";
import { aggiornaTest, getTest } from "@/lib/db";
import { salvaModifica } from "@/lib/salva-modifica";
import type { Operazione } from "@/lib/modifica-test";

type Ctx = { params: Promise<{ id: string }> };

export const GET = gestisci(async (_req: Request, ctx: Ctx) => {
  const t = await getTest((await ctx.params).id);
  if (!t) throw new Error("Test non trovato");
  return t;
});

/** Cambia lo stato ({stato}) oppure applica una modifica manuale ({operazione}). */
export const PATCH = gestisci(async (req: Request, ctx: Ctx) => {
  const id = (await ctx.params).id;
  const body = await req.json();
  if (body.operazione) {
    const op = body.operazione as Operazione;
    if (!["campi", "sostituisci", "elimina", "aggiungi"].includes(op.tipo)) throw new Error("Modifica non valida");
    if (op.tipo === "campi" && op.campi.nome !== undefined && !op.campi.nome.trim()) throw new Error("Il titolo non può essere vuoto");
    const problemi = await salvaModifica(id, op);
    return { problemi };
  }
  if (!["bozza", "approvato", "scartato"].includes(body.stato)) throw new Error("Stato non valido");
  await aggiornaTest(id, { stato: body.stato });
  return { ok: true };
});
