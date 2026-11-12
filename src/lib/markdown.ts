// Correzioni al markdown scritto dall'AI.

const rigaTabella = (r: string) => /^\s*\|.*\|\s*$/.test(r);
const separatore = (r: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(r);

/** Aggiunge la riga |---| che a volte l'AI dimentica: senza, la tabella viene mostrata come testo. */
export function sistemaTabelle(md: string): string {
  if (!md || !md.includes("|")) return md;
  const righe = md.split("\n");
  const out: string[] = [];
  for (let i = 0; i < righe.length; i++) {
    const r = righe[i];
    out.push(r);
    const inizioTabella = rigaTabella(r) && (i === 0 || !rigaTabella(righe[i - 1]));
    if (inizioTabella && i + 1 < righe.length && rigaTabella(righe[i + 1]) && !separatore(righe[i + 1])) {
      const colonne = r.trim().replace(/^\||\|$/g, "").split("|").length;
      out.push("|" + Array(colonne).fill("---").join("|") + "|");
    }
  }
  return out.join("\n");
}
