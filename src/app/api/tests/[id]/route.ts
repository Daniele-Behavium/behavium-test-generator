import { gestisci } from "@/lib/api";
import { aggiornaTest, getTest } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export const GET = gestisci(async (_req: Request, ctx: Ctx) => {
  const t = await getTest((await ctx.params).id);
  if (!t) throw new Error("Test non trovato");
  return t;
});

export const PATCH = gestisci(async (req: Request, ctx: Ctx) => {
  const { stato } = await req.json();
  if (!["bozza", "approvato", "scartato"].includes(stato)) throw new Error("Stato non valido");
  await aggiornaTest((await ctx.params).id, { stato });
  return { ok: true };
});
