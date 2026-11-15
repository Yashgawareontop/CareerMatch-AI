# Phase 3 — AI Skill & Career-Goal Analysis

**Status: done (2026-11-14), except optional task 4 (O*NET, not started).**
Checked on 5 resume texts (student, intern, mid-level, senior, messy
formatting): Groq `gpt-oss-120b` returned valid JSON for 5/5 (~4 s each),
Gemini `gemini-3.6-flash` for 4/5 (~25 s each; the 5th hit the free-tier
quota, which falls back to Groq in the app). Not yet re-run on the Phase 2
sample files. Notes:
- Gemini Flash with default thinking took ~100 s per resume, so analysis
  sends `reasoning: "minimal"` (an `AIProvider` option).
- Groq rejects malformed JSON-mode output with a 400 `json_validate_failed`;
  that is handled as an invalid reply (retry with the error), not an outage.
- ESCO's search is fuzzy, so only exact label / alternative-label matches are
  accepted. Most tech skills are resolved by the alias map before ESCO.

**Goal:** produce structured, validated data about the user from their resume text.

## Tasks
1. `lib/analysis/schema.ts` defines the Zod schema for the result:
   - `skills[]`: `{ name, category (language|framework|tool|cloud|soft), level, evidence }`
   - `experience[]`, `projects[]`, `education[]`
   - `seniority`: student | intern | junior | mid | senior
   - `inferredRoles[]`, and `careerGoals` merged with the user's preferences
   - `summary`, `strengths[]`, `gaps[]`
2. Prompting: send a system prompt plus the resume text through
   `getAIProvider()` with `json: true`. Validate the reply with Zod. If it
   fails, retry once with the error message included, then try the other
   provider.
3. Skill name cleanup: check a fixed alias map first, then look up unknown
   names in ESCO. Cache the results in Convex.
4. Optional: use O*NET to map a target role to the skills it requires, and
   show the gap.
5. Schema: an `analyses` table with resumeId, userId, provider, model, result
   and createdAt. Keep earlier analyses as history.
6. Save the model and prompt version strings with each analysis so results can
   be reproduced.

## Exit criteria
- Gemini and Groq both return valid JSON for all sample resumes
- A user can see and correct the extracted skills, and the corrected skills are what gets stored
