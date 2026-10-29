# Behavium · Generatore test

Web app interna che genera test **in-basket** e **situazionali** a partire da job title e job description, usando Claude (via OpenRouter). Il test viene salvato come bozza, rivisto dal team e poi esportato per Strapi.

## Come funziona

1. **Analisi della JD**: Claude propone seniority, durata, dimensioni e sotto-dimensioni del catalogo (con pesi e motivazioni). Rispetta il campo "focus" e le esclusioni.
2. **Revisione**: chi usa il tool corregge selezione, pesi, seniority e durata.
3. **Piano**: Claude progetta scenario e piano di email/domande. Il codice verifica le regole fisse del framework (`src/lib/regole.ts`) e, se servono correzioni, fa rigenerare il piano.
4. **Contenuti**: email o domande generate a lotti in parallelo, poi controllate. Gli elementi con errori vengono corretti automaticamente una volta.
5. **Revisione e feedback**: ogni elemento mostra quali sotto-dimensioni testa e perché. Si lascia un feedback per elemento o sul test intero, e si può rigenerare un singolo elemento.

## Come impara

- **Regole apprese**: dalla pagina "Regole apprese" Claude trasforma i commenti dei feedback in regole generali. Le regole approvate entrano in tutte le generazioni successive.
- **Esempi**: i test con stato "approvato" diventano esempi di riferimento per i test dello stesso tipo.

## File importanti

| File | Cosa contiene |
|---|---|
| `src/catalog/dimensioni.json` | Catalogo dimensioni e sotto-dimensioni con declaratorie e griglie 1-5. **Provvisorio**: va sostituito con quello definitivo mantenendo la struttura. |
| `src/lib/regole.ts` | Regole fisse del framework (numero email, categorie obbligatorie, critiche, trappole, budget di tempo del situazionale...). |
| `src/lib/prompts.ts` | Prompt di Claude. |
| `src/lib/strapi-export.ts` | Conversione nel formato Strapi. **Nomi dei campi da allineare** agli `schema.json` reali. |
| `supabase/schema.sql` | Tabelle del database. |

## Setup

1. **Supabase**: crea un progetto ed esegui `supabase/schema.sql` nel SQL Editor.
2. **Vercel**: importa il repository e imposta le variabili d'ambiente:

| Variabile | Valore |
|---|---|
| `OPENROUTER_API_KEY` | Chiave OpenRouter |
| `OPENROUTER_MODEL` | Facoltativa, default `anthropic/claude-opus-5.5` |
| `SUPABASE_URL` | Project URL di Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key di Supabase (resta sul server) |
| `APP_PASSWORD` | Password condivisa per accedere al tool |

3. Le funzioni di generazione durano fino a qualche minuto: in Vercel serve che la durata massima delle funzioni sia almeno 300 secondi (impostata nel codice con `maxDuration`).

## Sviluppo locale

```bash
npm install
cp .env.example .env.local   # e compila le variabili
npm run dev
```

Senza variabili Supabase, in locale i dati finiscono nel file `.dev-db.json`.

## Tempi e costi indicativi (Claude Opus 5.5)

| Tipo | Tempo | Costo |
|---|---|---|
| In-basket 90 min, 8 email | circa 5 minuti | circa 0,85 $ |
| Situazionale 35 min | circa 6-8 minuti | circa 1-1,4 $ |
| Rigenerazione di un elemento | circa 30 secondi | circa 0,05 $ |
