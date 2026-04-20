# CT-AGENT (V1.3)

CT-AGENT is a V1.3 prototype for your GenAI + critical thinking study.

It includes three role-specific experiences:

- Student Coach: Socratic critical-thinking dialogue
- Instructor Copilot: culturally tailored prompt template generator
- Research Analytics: event-based metrics dashboard

V1.3 adds week-aligned template publishing and structured logging fields for research tracking (course, week, assignment, session, turn, template version).

## Tech stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- OpenAI SDK (optional; app has local fallback behavior)
- Storage modes:
  - Local file mode (default local dev): `data/store.json`
  - Vercel demo mode (automatic on Vercel): in-memory runtime store

## Run locally

1. Install dependencies

```bash
npm install
```

2. Configure environment variables

```bash
copy .env.example .env
```

Optional, for real LLM responses:

```bash
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-5-nano
```

3. Start dev server

```bash
npm run dev
```

Open `http://localhost:3000`.

## Deploy to Vercel (Demo)

1. Push this repo to GitHub
2. Import the repo in Vercel
3. Add environment variables:

```bash
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-5-nano
```

4. Deploy

Notes for Vercel demo mode:

- On Vercel, storage automatically runs in memory mode (`VERCEL=1`)
- Data is ephemeral and can reset on cold starts/redeploys
- This is suitable for demo and pilot walkthroughs, not durable research storage

## Mock roles

Use one of these links to enter each mode:

- `http://localhost:3000/student?mock_role=student`
- `http://localhost:3000/instructor?mock_role=instructor`
- `http://localhost:3000/research?mock_role=researcher`

## V1.3 architecture

- `app/student`: student-facing Socratic chat UI + automatic template sync by week/assignment
- `app/instructor`: scaffold-based prompt-generation UI + active template publishing by week/assignment + adequacy checker
- `app/research`: analytics view with course/week/assignment filters
- `app/api/chat`: coach reply generation + event logging
- `app/api/templates`: scaffold generation + retrieval + active scaffold updates
- `app/api/analytics`: aggregate metrics endpoint
- `lib/store.ts`: local event store with write lock
- `lib/analytics.ts`: metric calculations
- `lib/template-scaffold.ts`: scaffold normalization and string rendering
- `lib/template-quality.ts`: HOT adequacy checks

## Instructor -> Student scaffold injection flow (week-aligned)

1. Instructor generates 3 structured scaffolds for a specific course + week + assignment.
2. First scaffold is auto-marked active for that week-assignment context.
3. Instructor can switch active scaffold with `Set active for students`.
4. Student page auto-syncs the active scaffold by `courseId + weekNumber + assignmentId` and injects it into chat context.
5. Chat events log structured metadata including `weekNumber`, `assignmentId`, `sessionId`, `turnIndex`, and template version.

## Structured log fields (V1.3)

Each interaction event now supports:

- `courseId`
- `weekNumber`
- `assignmentId`
- `sessionId`
- `turnIndex`
- `templateVersion` (in payload)

## HOT adequacy checker (Instructor)

The active scaffold is checked for:

- Counterargument requirement
- Bias/threat identification
- Minimum evidence standard
- Method limits/uncertainty reflection
- Transfer/application question

## UI theme

The UI follows UT System primary colors from the official brand page:

- Tennessee Orange `#ff8200`
- Smoky Mountain Gray `#4B4B4B`

## Data model (V1.3)

Events are appended with structured fields, including:

- event type
- role
- userId
- courseId
- weekNumber
- assignmentId
- sessionId
- turnIndex
- timestamp
- payload

## Notes

- This version is intentionally lightweight and suitable for pilot/demo use.
- It is not production hardened yet (no full auth provider, no consent workflow UI, no durable cloud persistence in Vercel demo mode).
