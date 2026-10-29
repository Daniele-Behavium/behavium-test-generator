// Accesso con password condivisa (variabile APP_PASSWORD) e nome di chi usa il tool.
export const COOKIE_AUTH = "bh_auth";
export const COOKIE_NOME = "bh_nome";

export async function hashPassword(pw: string): Promise<string> {
  const data = new TextEncoder().encode("behavium-tg:" + pw);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
