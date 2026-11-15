# Phase 5 — Matching & Recommendations

**Status: done (2026-11-15), except the hand-labelled 20×20 test set and the
optional local-embedding fallback (task 6).** See "Matching flow" in
`docs/architecture.md`. Notes:
- Embeddings live in a separate `jobEmbeddings` table (vector index there), not
  on `jobs`, so listing queries don't ship 768 floats per row to the browser.
- Gemini's free tier allows **100 embedded texts per minute** (each text in a
  batch counts). `embed()` waits out 429s within a time budget; the sync embeds
  new listings and `POST /api/jobs/embed` backfills. All 762 listings embedded.
- Checked on the one real analysis (student → data analyst intern): recall
  ~1.6 s for 56 candidates, Groq explanations ~1.8 s for the top 10. Data-analyst
  internships rank first. Tuning from that run: similarities sit in 0.60–0.70,
  so the semantic band is 0.55–0.75; skill overlap divides by
  max(4, listing skills) so one-skill listings don't score 100%; reposts with
  the same title + location collapse to one.
- Cached matches load through the reactive `matches.mine` query (no AI on load).

**Goal:** give each user a ranked list of jobs and internships, with a reason for each match.

## Tasks
1. Embeddings: add `embed(text)` to `lib/ai`, using Gemini
   `gemini-embedding-001` (Groq has no embeddings). Embed each job once, when
   it is ingested. Embed the user profile (skills, goals and preferences)
   after each analysis.
2. Add a Convex vector index on `jobs`, with type and remote as filter fields.
3. Rank in two steps:
   - **Recall:** vector search for the top 50 jobs, in a Convex action, then
     load the full job records.
   - **Score:** combine semantic similarity, skill overlap (using the cleaned
     skill names) and preference fit (location, type, level), minus a penalty
     for older listings.
4. Explanations: for the top 10 jobs, one batched AI call returns why each job
   matches and which skills the user is missing. Cache these in a `matches`
   table.
5. Feedback: users can save or dismiss a job, or mark it as applied. Use this
   to improve the ranking later.
6. Backup option: if the free quota runs out, create embeddings locally with
   `@huggingface/transformers`.

## Exit criteria
- Cached recommendations load in under 2 seconds
- On a hand-labelled test set of 20 users and 20 jobs, most of each user's top 5 jobs are relevant
