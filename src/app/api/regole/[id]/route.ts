import { gestisci } from "@/lib/api";
import { aggiornaRegola } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = gestisci(async (req: Request, ctx: Ctx) => {
  const { testo, ambito, stato } = await req.json();
  const patch: Record<string, string> = {};
  if (testo !== undefined) patch.testo = String(testo);
  if (ambito !== undefined) patch.ambito = ambito;
  if (stato !== undefined) patch.stato = stato;
  await aggiornaRegola((await ctx.params).id, patch);
  return { ok: true };
});
