import { gestisci, nomeUtente } from "@/lib/api";
import { aggiungiFeedback, feedbackDelTest } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export const GET = gestisci(async (_req: Request, ctx: Ctx) => feedbackDelTest((await ctx.params).id));

export const POST = gestisci(async (req: Request, ctx: Ctx) => {
  const { item_ref, esito, commento } = await req.json();
  if (!["ok", "da_rivedere"].includes(esito)) throw new Error("Esito non valido");
  return aggiungiFeedback({
    test_id: (await ctx.params).id,
    item_ref: item_ref || null,
    esito,
    commento: String(commento ?? "").slice(0, 4000),
    autore: await nomeUtente(),
  });
});
