# OfferGlow Pro

OfferGlow Pro turns a resume into a targeted application page with lightweight read signals.

## Current Status

This repo now contains two layers:

- `index.html`: standalone interactive prototype that can be served with `python3 -m http.server`.
- `src/app`: Next.js App Router scaffold for the real product build.

Implemented in the Next scaffold:

- Bright minimal home page.
- Resume upload / paste dual entry.
- Text and `.txt` / `.md` resume parsing.
- PDF parsing path through `pdf-parse`.
- DOCX parsing path through `mammoth`.
- Master profile JSON editor.
- Template 01 adaptive rendering.
- JD gap hints.
- Targeted rewrite API scaffold.
- Visit / duration / module-click simulation.
- `POST /api/parse-resume` route for text, `.txt`, `.md`, `.pdf`, and `.docx`.
- `POST /api/rewrite-for-jd` route returning rule-based gaps, anchor questions, and instance JSON.

Not implemented yet:

- Real AI structured extraction and STAR rewrite.
- Supabase persistence.
- Public `/u/[slug]` pages.
- Real tracking events.
- Payment / membership.

## Local Preview

Standalone prototype:

```bash
python3 -m http.server 4180 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:4180/index.html
```

Next.js app:

```bash
npm install
npm run dev
```

This machine currently has Node but no package manager (`npm`, `pnpm`, `yarn`, and `corepack` are unavailable), so the Next app cannot be started here until one is installed.

## DeepSeek Setup

Create `.env.local` in the project root:

```bash
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

Do not commit `.env.local`.

When `DEEPSEEK_API_KEY` exists:

- `POST /api/parse-resume` extracts raw text, then asks DeepSeek to return a structured `MasterProfile`.
- `POST /api/rewrite-for-jd` asks DeepSeek to return advantages, gaps, anchor questions, rewritten instance JSON, and a QA notice.

When `DEEPSEEK_API_KEY` is missing, both routes fall back to the local rule-based implementation.

## Next Build Steps

1. Add a package manager and install dependencies.
2. Start the Next app and verify the migrated page.
3. Verify `POST /api/parse-resume` with TXT, MD, PDF, and DOCX files.
4. Verify DeepSeek extraction quality on real resumes.
5. Add before/after diff highlighting for AI-written sections.
6. Add Supabase tables for `master_profiles`, `targeted_instances`, and `tracking_events`.
7. Add `/u/[slug]` public resume pages and dashboard tracking.

## Vercel Deploy

Use Vercel for a stable shareable URL. Required environment variables:

```bash
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

Recommended settings:

- Framework Preset: Next.js
- Build Command: `next build`
- Output Directory: leave empty
- Install Command: `npm install`

Do not upload `.env.local`; set the same values in Vercel Project Settings -> Environment Variables.
