import "server-only";

export const MODELLO = process.env.OPENROUTER_MODEL || "anthropic/claude-opus-5.5";

export interface RisultatoAI<T> {
  dati: T;
  costo: number;
  modello: string;
}

/**
 * Chiamata a OpenRouter con output strutturato (JSON che rispetta uno schema).
 */
export async function chiamaAI<T>(opts: {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  temperature?: number;
  tentativi?: number;
  /** Token di ragionamento concessi al modello prima della risposta (si sommano a maxTokens). */
  ragionamento?: number;
}): Promise<RisultatoAI<T>> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY non configurata");

  let ultimoErrore: unknown;
  let costoAccumulato = 0;
  for (let tentativo = 0; tentativo < (opts.tentativi ?? 2); tentativo++) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://behavium.it",
        "X-Title": "Behavium Test Generator",
      },
      body: JSON.stringify({
        model: MODELLO,
        max_tokens: (opts.maxTokens ?? 16000) + (opts.ragionamento ?? 3000),
        reasoning: opts.ragionamento === 0 ? { enabled: false } : { max_tokens: opts.ragionamento ?? 3000 },
        ...(opts.ragionamento === 0 ? { temperature: opts.temperature ?? 0.7 } : {}), // con il ragionamento attivo Anthropic accetta solo la temperatura di default
        usage: { include: true },
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: opts.schemaName, strict: true, schema: opts.schema },
        },
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      ultimoErrore = new Error(`OpenRouter ${res.status}: ${JSON.stringify(body?.error ?? body).slice(0, 500)}`);
      if (res.status >= 500 || res.status === 429) continue;
      throw ultimoErrore;
    }
    const testo: string = body?.choices?.[0]?.message?.content ?? "";
    const fine = body?.choices?.[0]?.finish_reason;
    costoAccumulato += Number(body?.usage?.cost ?? 0);
    try {
      const dati = JSON.parse(estraiJson(testo)) as T;
      return { dati, costo: costoAccumulato, modello: body?.model ?? MODELLO };
    } catch (e) {
      console.error(`[AI] JSON non valido (${opts.schemaName}) finish=${fine} native=${body?.choices?.[0]?.native_finish_reason} usage=${JSON.stringify(body?.usage)} len=${testo.length}`);
      ultimoErrore = new Error(`Risposta AI non valida (JSON, fine: ${fine}): ${String(e)}`);
    }
  }
  throw ultimoErrore;
}

function estraiJson(t: string): string {
  const s = t.trim();
  if (s.startsWith("{") || s.startsWith("[")) return s;
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) return m[1];
  const i = s.indexOf("{");
  const j = s.lastIndexOf("}");
  return i >= 0 && j > i ? s.slice(i, j + 1) : s;
}
