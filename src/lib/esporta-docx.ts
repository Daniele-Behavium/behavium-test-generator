// Export del test in Word (.docx), con gli stessi campi che vanno caricati in Strapi.
// Sotto-dimensioni e motivazioni dei singoli elementi restano fuori, come nel JSON per Strapi.
// Ogni campo riporta tra parentesi il nome del campo Strapi, per facilitare il caricamento a mano.

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IRunOptions,
  type ParagraphChild,
} from "docx";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import type { RootContent, PhrasingContent, List } from "mdast";
import type { TestGenerato } from "./types";
import { getDimensione, getSottoDimensione } from "./catalog";

const FONT = "Arial";
const GRIGIO = "6B7280";
const LARGHEZZA = 9360; // A4 con margini di 2,5 cm circa, in DXA (1/1440 di pollice)

const CATEGORIE: Record<string, string> = {
  strategicDeadline: "Scadenza strategica",
  urgentOperational: "Urgenza operativa",
  personalEmotional: "Personale/emotiva",
  externalComplaint: "Reclamo esterno",
  numericReport: "Dati/report",
  agendaOverlap: "Agenda sovrapposta",
  other: "Altro",
};
const VALUTAZIONI: Record<string, string> = { migliore: "Migliore", accettabile: "Accettabile", da_evitare: "Da evitare" };

// ---------- markdown → paragrafi Word ----------
let istanzaElenco = 0;

function runs(nodi: PhrasingContent[], stile: IRunOptions = {}): ParagraphChild[] {
  return nodi.flatMap((n): ParagraphChild[] => {
    switch (n.type) {
      case "text":
        return [new TextRun({ ...stile, text: n.value })];
      case "strong":
        return runs(n.children, { ...stile, bold: true });
      case "emphasis":
        return runs(n.children, { ...stile, italics: true });
      case "delete":
        return runs(n.children, { ...stile, strike: true });
      case "inlineCode":
        return [new TextRun({ ...stile, text: n.value, font: "Courier New" })];
      case "link":
        return runs(n.children, { ...stile, underline: {} });
      case "break":
        return [new TextRun({ ...stile, break: 1 })];
      default:
        return "children" in n ? runs(n.children as PhrasingContent[], stile) : [];
    }
  });
}

function blocchiMd(nodi: RootContent[], livello = 0): (Paragraph | Table)[] {
  return nodi.flatMap((n): (Paragraph | Table)[] => {
    switch (n.type) {
      case "paragraph":
        return [new Paragraph({ children: runs(n.children), spacing: { after: 120 } })];
      case "heading":
        return [new Paragraph({ children: runs(n.children, { bold: true, size: n.depth <= 2 ? 24 : 22 }), spacing: { before: 200, after: 80 }, keepNext: true })];
      case "list":
        return elenco(n, livello);
      case "table":
        return [tabellaMd(n.children.map((r) => r.children.map((c) => runs(c.children)))), new Paragraph({ spacing: { after: 60 } })];
      case "blockquote":
        return blocchiMd(n.children).map((p) => p);
      case "code":
        return n.value.split("\n").map((riga) => new Paragraph({ children: [new TextRun({ text: riga, font: "Courier New", size: 18 })] }));
      case "thematicBreak":
        return [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB", space: 1 } } })];
      default:
        return [];
    }
  });
}

function elenco(l: List, livello: number): Paragraph[] {
  const istanza = ++istanzaElenco;
  return l.children.flatMap((voce) =>
    voce.children.flatMap((figlio, i): Paragraph[] => {
      if (figlio.type === "list") return elenco(figlio, livello + 1);
      if (figlio.type !== "paragraph") return blocchiMd([figlio], livello) as Paragraph[];
      return [
        new Paragraph({
          children: runs(figlio.children),
          spacing: { after: 60 },
          ...(i === 0
            ? { numbering: { reference: l.ordered ? "numeri" : "punti", level: Math.min(livello, 2), instance: l.ordered ? istanza : undefined } }
            : { indent: { left: 720 * (livello + 1) } }),
        }),
      ];
    })
  );
}

function cella(contenuto: ParagraphChild[] | (Paragraph | Table)[], larghezza: number, intestazione = false) {
  const figli = contenuto.length && (contenuto[0] instanceof Paragraph || contenuto[0] instanceof Table) ? (contenuto as (Paragraph | Table)[]) : [new Paragraph({ children: contenuto as ParagraphChild[] })];
  return new TableCell({
    children: figli.length ? figli : [new Paragraph("")],
    width: { size: larghezza, type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    shading: intestazione ? { fill: "F3F4F6", type: ShadingType.CLEAR, color: "auto" } : undefined,
  });
}

function tabellaMd(righe: ParagraphChild[][][]) {
  const colonne = Math.max(1, ...righe.map((r) => r.length));
  const w = Math.floor(LARGHEZZA / colonne);
  return new Table({
    width: { size: w * colonne, type: WidthType.DXA },
    columnWidths: Array(colonne).fill(w),
    rows: righe.map((r, i) => new TableRow({ tableHeader: i === 0, children: Array.from({ length: colonne }, (_, j) => cella(r[j] ?? [], w, i === 0)) })),
  });
}

function md(testo: string) {
  if (!testo?.trim()) return [new Paragraph({ children: [new TextRun({ text: "(vuoto)", color: GRIGIO, italics: true })] })];
  const albero = fromMarkdown(testo, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
  return blocchiMd(albero.children);
}

// ---------- blocchi del documento ----------
function etichetta(nome: string, campoStrapi: string) {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 160, after: 60 },
    children: [new TextRun({ text: nome, bold: true, size: 20 }), new TextRun({ text: `  (${campoStrapi})`, color: GRIGIO, size: 16 })],
  });
}

/** Tabella a due colonne campo / valore per i dati brevi. */
function schedaCampi(campi: [string, string, string][]) {
  const w1 = 3000;
  const w2 = LARGHEZZA - w1;
  return new Table({
    width: { size: LARGHEZZA, type: WidthType.DXA },
    columnWidths: [w1, w2],
    rows: campi.map(
      ([nome, strapi, valore]) =>
        new TableRow({
          children: [
            cella([new TextRun({ text: nome, bold: true, size: 18 }), new TextRun({ text: ` (${strapi})`, color: GRIGIO, size: 16 })], w1, true),
            cella([new TextRun({ text: valore || "-", size: 20 })], w2),
          ],
        })
    ),
  });
}

const titolo = (testo: string, livello: (typeof HeadingLevel)[keyof typeof HeadingLevel]) => new Paragraph({ heading: livello, children: [new TextRun(testo)], keepNext: true });
const nomiDimensioni = (ids: string[]) => ids.map((d) => getDimensione(d)?.nome ?? d).join(", ");

export async function testInWord(t: TestGenerato): Promise<Blob> {
  istanzaElenco = 0;
  const corpo: (Paragraph | Table)[] = [];

  corpo.push(titolo(t.nome, HeadingLevel.TITLE));
  corpo.push(
    schedaCampi([
      ["Titolo", "name", t.nome],
      ["Tipo", "type", t.tipo === "inBasket" ? "In-basket" : "Situazionale"],
      ["Contesto d'uso", "usageContext", t.contesto],
      ["Ruolo target", "targetRole", t.ruoloTarget],
      ["Seniority", "seniority", t.seniority],
      ["Durata (minuti)", "durationMinutes", String(t.durata)],
      ["Lingua", "language", t.lingua.toUpperCase()],
    ])
  );

  corpo.push(titolo("Dimensioni e pesi", HeadingLevel.HEADING_1));
  corpo.push(etichetta("Criteri di valutazione", "scoringCriteria"));
  corpo.push(
    schedaCampi(
      t.dimensioni.map((d) => [
        `${getDimensione(d.dimensioneId)?.nome ?? d.dimensioneId}`,
        `peso ${d.peso}`,
        d.sottoDimensioni.map((s) => getSottoDimensione(s.id)?.sub.nome ?? s.id).join(", "),
      ])
    )
  );

  corpo.push(titolo("Istruzioni del test", HeadingLevel.HEADING_1));
  corpo.push(etichetta("Istruzioni", "instructions"), ...md(t.istruzioni));
  corpo.push(etichetta("Introduzione tecnica", "technicalIntroduction"), ...md(t.introduzioneTecnica));

  if (t.tipo === "inBasket") {
    corpo.push(titolo(`Email (${t.email.length})`, HeadingLevel.HEADING_1));
    t.email.forEach((e, i) => {
      corpo.push(new Paragraph({ heading: HeadingLevel.HEADING_2, pageBreakBefore: i > 0, keepNext: true, children: [new TextRun(`${e.ref} · ${e.oggetto}`)] }));
      corpo.push(
        schedaCampi([
          ["Mittente", "sender", e.mittente],
          ["Destinatario", "recipient", e.destinatario],
          ["Oggetto", "subject", e.oggetto],
          ["Arrivo (minuti dall'inizio)", "delayMinutes", String(e.ritardo)],
          ["Categoria", "category", CATEGORIE[e.categoria] ?? e.categoria],
          ["Critica", "flagCritical", e.critica ? "Sì" : "No"],
          ["Contiene trappola", "flagTrap", e.contieneTrappola ? "Sì" : "No"],
          ["Dimensioni", "dimensions", nomiDimensioni(e.dimensioni)],
        ])
      );
      corpo.push(etichetta("Corpo dell'email", "body"), ...md(e.corpo));
      if (e.contieneTrappola) corpo.push(etichetta("Descrizione della trappola", "trapDescription"), ...md(e.descrizioneTrappola));
      corpo.push(etichetta("Comportamento atteso", "expectedBehavior"), ...md(e.comportamentoAtteso));
    });
  } else {
    t.blocchi.forEach((b, bi) => {
      corpo.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, keepNext: true, children: [new TextRun(`Blocco ${bi + 1} · ${b.titolo}`)] }));
      corpo.push(etichetta("Titolo del blocco", "title"), new Paragraph(b.titolo));
      b.domande.forEach((d) => {
        corpo.push(new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, spacing: { before: 360 }, children: [new TextRun(`${d.ref} · ${d.rispostaAScelta ? "a scelta" : "aperta"}`)] }));
        corpo.push(
          schedaCampi([
            ["Risposta a scelta", "isMultipleChoice", d.rispostaAScelta ? "Sì" : "No"],
            ["Dimensioni", "dimensions", nomiDimensioni(d.dimensioni)],
          ])
        );
        corpo.push(etichetta("Testo della domanda", "text"), ...md(d.testo));
        if (d.outputAISimulato) corpo.push(etichetta("Output AI simulato", "simulatedAiOutput"), ...md(d.outputAISimulato));
        if (d.rispostaAScelta && d.opzioni.length) {
          corpo.push(etichetta("Opzioni di risposta", "responseOptions"));
          const w1 = 600;
          const w3 = 1700;
          const w2 = LARGHEZZA - w1 - w3;
          corpo.push(
            new Table({
              width: { size: LARGHEZZA, type: WidthType.DXA },
              columnWidths: [w1, w2, w3],
              rows: [
                new TableRow({ tableHeader: true, children: [cella([new TextRun({ text: "", size: 18 })], w1, true), cella([new TextRun({ text: "Testo (text)", bold: true, size: 18 })], w2, true), cella([new TextRun({ text: "Valutazione (evaluation)", bold: true, size: 18 })], w3, true)] }),
                ...d.opzioni.map(
                  (o, i) =>
                    new TableRow({
                      children: [
                        cella([new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String.fromCharCode(65 + i), bold: true })] })], w1),
                        cella(md(o.testo), w2),
                        cella([new TextRun({ text: VALUTAZIONI[o.valutazione] ?? o.valutazione, size: 20 })], w3),
                      ],
                    })
                ),
              ],
            })
          );
        }
        corpo.push(etichetta("Comportamento atteso", "expectedBehavior"), ...md(d.comportamentoAtteso));
      });
    });
  }

  const doc = new Document({
    creator: "Behavium Test Generator",
    title: t.nome,
    styles: {
      default: { document: { run: { font: FONT, size: 21 } } },
      paragraphStyles: [
        { id: "Title", name: "Title", basedOn: "Normal", run: { size: 40, bold: true, font: FONT }, paragraph: { spacing: { after: 240 } } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 30, bold: true, font: FONT }, paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 25, bold: true, font: FONT }, paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      ],
    },
    numbering: {
      config: [
        {
          reference: "punti",
          levels: [0, 1, 2].map((level) => ({ level, format: LevelFormat.BULLET, text: ["•", "◦", "▪"][level], alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } } })),
        },
        {
          reference: "numeri",
          levels: [0, 1, 2].map((level) => ({ level, format: LevelFormat.DECIMAL, text: `%${level + 1}.`, alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } } })),
        },
      ],
    },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1270, bottom: 1270, left: 1270, right: 1270 } } }, children: corpo }],
  });
  return Packer.toBlob(doc);
}
