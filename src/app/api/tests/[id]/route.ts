import { gestisci } from "@/lib/api";
import { aggiornaTest, getTest } from "@/lib/db";
import { salvaModifica } from "@/lib/salva-modifica";
import type { TestGenerato } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export const GET = gestisci(async (_req: Request, ctx: Ctx) => {
  const t = await getTest((await ctx.params).id);
  if (!t) throw new Error("Test non trovato");
  return t;
});

/** Cambia lo stato ({stato}) oppure salva il test modificato a mano ({test}). */
export const PATCH = gestisci(async (req: Request, ctx: Ctx) => {
  const id = (await ctx.params).id;
  const body = await req.json();
  if (body.test) {
    const rec = await getTest(id);
    if (!rec) throw new Error("Test non trovato");
    const t = body.test as TestGenerato;
    if (t.tipo !== rec.test.tipo || !Array.isArray(t.email) || !Array.isArray(t.blocchi)) throw new Error("Test non valido");
    if (!t.nome?.trim()) throw new Error("Il titolo non può essere vuoto");
    const problemi = await salvaModifica(rec, t);
    return { problemi };
  }
  if (!["bozza", "approvato", "scartato"].includes(body.stato)) throw new Error("Stato non valido");
  await aggiornaTest(id, { stato: body.stato });
  return { ok: true };
});
