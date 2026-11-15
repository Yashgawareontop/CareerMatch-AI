# Free & Open-Source Resources

Researched November 2026. Free tiers change often: **check each provider's own
page before relying on a number.** Figures marked "reported" come from
third-party write-ups, not the provider.

## 1. AI / LLM APIs

| Provider | What we use it for | Free? | Key | Notes |
| --- | --- | --- | --- | --- |
| **Google Gemini** | Resume analysis, structured JSON extraction, embeddings | Free tier (AI Studio) | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Stable models now include `gemini-3.6-flash`, `gemini-3.8-flash`, `gemini-3.5-flash-lite`. Embeddings: `gemini-embedding-001`, `gemini-embedding-2`. Reported: free tier limited to Flash/Flash-Lite since April 2026, quotas cut in Dec 2025. Google no longer publishes the free per-model limits; see them in AI Studio. Free-tier prompts **may be used by Google to improve products**, so tell users in the privacy notice. [Models](https://aistudio.google.com/docs/models) |
| **Groq** | Fast fallback; cheap classification/summary calls | Free plan, no card | [console.groq.com/keys](https://console.groq.com/keys) | Production chat models: `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `openai/gpt-oss-120b`, `openai/gpt-oss-20b`. Reported limits: about 30 RPM, 500–14,400 requests/day depending on model. No embeddings. [Models](https://console.groq.com/docs/models) |

SDKs installed: `@google/genai`, `groq-sdk`.

## 2. Job & internship data APIs

| Source | Key | Coverage | Notes |
| --- | --- | --- | --- |
| **Adzuna** | Free `app_id` + `app_key` | 16+ countries incl. India (`in`) | Reported about 1,000 calls/month on the free tier. Has salary data. Check the licence terms: one source mentions a trial period. [developer.adzuna.com](https://developer.adzuna.com/) |
| **Jooble** | Free key on request | 60+ countries | POST with keywords. Links point to Jooble pages. [jooble.org/api/about](https://jooble.org/api/about) |
| **Arbeitnow** | Sources disagree on whether a key is needed | Europe, remote | About 100 jobs per page, refreshed hourly. [arbeitnow.com/blog/job-board-api](https://www.arbeitnow.com/blog/job-board-api) |
| **Remotive** | None | Remote tech | Small, delayed feed. Keep to a few calls a day and **credit Remotive with a link**. [remotive.com/api-documentation](https://remotive.com/api-documentation) |
| **RemoteOK** | None | Remote tech | Attribution required. [remoteok.com/api](https://remoteok.com/api) |
| **Himalayas** | None | Remote | Public jobs JSON API. [himalayas.app/api](https://himalayas.app/api) |
| **USAJOBS** | Free key | US federal (has student/intern programmes) | [developer.usajobs.gov](https://developer.usajobs.gov/) |

**Internships:** no free API offers a reliable "internship" filter. We search
keywords (`intern`, `internship`, `trainee`, `graduate`) and let the AI
classify job level. Internshala, LinkedIn and Indeed have **no public API**, and
scraping them breaks their terms. Do not scrape them.

**Plan:** start with Adzuna (India) and Remotive/Arbeitnow (remote), then add
Jooble. Cache results in Convex so we stay well under free quotas.

## 3. Skills & career taxonomies

| Resource | Access | Use |
| --- | --- | --- |
| **ESCO** (European Commission) | Web API plus a free CSV/RDF download | About 14k skills and 3k occupations in 20+ languages. Use it to normalise skill names ("JS" → "JavaScript"). [esco.ec.europa.eu](https://esco.ec.europa.eu/en/about-esco/faq) · [API docs](https://ec.europa.eu/esco/api/doc/esco-api-further-doc.html) |
| **O\*NET Web Services** (US DoL) | Free key, **attribution required**, rate-limited | 900+ occupations with required skills. Use it for career-goal → skills mapping. [services.onetcenter.org](https://services.onetcenter.org/about) |
| **O\*NET database** | Free download (CC BY) | Bulk offline alternative to the API. |

## 4. Resume parsing (open-source npm packages, installed in Phase 2)

| Package | Licence | Use |
| --- | --- | --- |
| `unpdf` | MIT | PDF → text; works in serverless/edge (wraps pdf.js) |
| `mammoth` | BSD-2 | DOCX → text |
| `file-type` | MIT | Check the real file type instead of trusting the extension |

Scanned/image resumes: send the file to Gemini directly (it accepts PDFs) as a
fallback, instead of running our own OCR.

## 5. Matching (Phase 5)

- **Embeddings:** Gemini `gemini-embedding-001` (free tier). Store the vectors in a
  Convex vector index.
- **Offline alternative:** `@huggingface/transformers` (Apache-2.0) with an
  open model such as `all-MiniLM-L6-v2`. Runs locally with no API limits.
- **Keyword fallback:** Convex full-text search indexes.

## 6. Platform pieces (free tiers / OSS)

| Need | Choice |
| --- | --- |
| Auth | Convex Auth (`@convex-dev/auth`, OSS) or Clerk free tier |
| Rate limiting | `@convex-dev/rate-limiter` (OSS Convex component) |
| Scheduled job refresh | Convex crons (built in) |
| File storage | Convex file storage (built in) |
| Testing | Vitest + `convex-test` + `@edge-runtime/vm`; Playwright for E2E |
| UI | shadcn/ui, lucide-react (already installed) |

## Sources

- [Free job APIs in 2026 (jobspipe.dev)](https://jobspipe.dev/blog/free-job-api)
- [Adzuna API overview](https://jobspipe.dev/blog/adzuna-api)
- [Jooble API overview](https://jobspipe.dev/blog/jooble-api)
- [Arbeitnow job board API](https://www.arbeitnow.com/blog/job-board-api)
- [Gemini models](https://aistudio.google.com/docs/models)
- [Gemini pricing changes 2026 (agentdeals.dev)](https://agentdeals.dev/gemini-api-pricing-changes)
- [Gemini free tier limits (yingtu.ai)](https://yingtu.ai/en/blog/google-gemini-api-free-tier)
- [Groq models](https://console.groq.com/docs/models)
- [Groq free tier (benchlm.ai)](https://benchlm.ai/free-tier/groq)
- [ESCO FAQ](https://esco.ec.europa.eu/en/about-esco/faq)
- [ESCO API docs](https://ec.europa.eu/esco/api/doc/esco-api-further-doc.html)
- [O\*NET Web Services](https://services.onetcenter.org/about)
- [ESCO API overview](https://jobspipe.dev/blog/esco-api)
