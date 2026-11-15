# Phase 2 — Resume Upload & Parsing

**Status: done (2026-11-14).** 10 generated samples (5 PDF incl. two-column,
multi-page, unicode and table layouts; 1 scanned; 4 DOCX incl. tables,
header/footer and Symbol-font bullets) all parse to readable text. Scanned
PDFs use Gemini Flash-Lite (~4 s). Re-check with real resumes as they come in.

**Goal:** turn an uploaded resume (PDF or DOCX) into clean plain text, stored in Convex.

## Tasks
1. Upload through Convex file storage: a `generateUploadUrl` mutation, then a
   POST from the browser. Accept PDF and DOCX only, up to 5 MB.
2. Route handler `app/api/resume/parse/route.ts` (Node runtime):
   - fetch the file from Convex storage
   - check the real file type with `file-type`
   - convert PDF with `unpdf` and DOCX with `mammoth`
   - if the result has almost no text (a scanned resume), send the PDF to
     Gemini to read instead
3. `lib/resume/`: `extractText(buffer, mime)`, plus cleanup of whitespace and
   bullets.
4. Schema: a `resumes` table with userId, storageId, fileName, rawText, error,
   and a status of `uploaded | parsing | parsed | failed`.
5. Limit uploads per user with `@convex-dev/rate-limiter`.

## Dependencies
`unpdf`, `mammoth`, `file-type`, `@convex-dev/rate-limiter`

## Exit criteria
- 10 sample resumes (PDF, DOCX and one scanned) all come out as readable text
- The client shows status changes live through a Convex query
