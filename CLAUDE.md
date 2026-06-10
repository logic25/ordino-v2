# Ordino V2 — CLAUDE.md

## Project Overview

Ordino is a CRM and operations platform for **Green Light Expediting LLC**, a NYC construction expediting firm. It manages projects, properties, clients, proposals, invoices, time tracking, RFPs, documents, and email — with AI features powered by Beacon (the embedded AI assistant).

**Domain context:** NYC Department of Buildings (DOB) expediting — filing permits, resolving objections, tracking violations, obtaining Certificates of Occupancy. Users are expeditors, project managers, and office staff who interact with DOB BIS, DOB NOW, and NYC Open Data APIs daily.

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite (SWC)
- **Styling:** Tailwind CSS + shadcn/ui (Radix UI primitives)
- **State:** TanStack React Query (server state) + Zustand (client state) + React Context (auth)
- **Forms:** React Hook Form + Zod validation
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions, Realtime)
- **Auth:** Lovable Cloud Auth → Supabase session
- **Testing:** Vitest + @testing-library/react + JSDOM
- **PDF:** @react-pdf/renderer
- **Rich Text:** TipTap
- **Charts:** Recharts

## Project Structure

```
src/
├── components/       # 26 feature directories + ui/
│   ├── ui/           # 51 shadcn/ui components (do not edit directly)
│   ├── projects/     # Project management, action items, change orders
│   ├── properties/   # Property tracking, CitiSignal, CO tracking
│   ├── clients/      # Client profiles, contacts, analytics
│   ├── proposals/    # Proposal creation, sending, e-signatures
│   ├── invoices/     # Invoicing, payment plans, QBO integration
│   ├── emails/       # Gmail integration, compose, templates
│   ├── rfps/         # RFP tracking, discovery, content library
│   ├── chat/         # Google Chat integration
│   ├── calendar/     # Google Calendar sync
│   ├── time/         # Time tracking, attendance, timesheets
│   ├── dashboard/    # Role-based dashboards
│   ├── documents/    # Document management, folders
│   ├── settings/     # 20+ settings modules
│   ├── assistant/    # Ask Ordino AI panel
│   ├── beacon/       # Beacon analytics
│   └── ...
├── hooks/            # 91 custom hooks (data fetching, business logic)
├── pages/            # 30 route pages
├── integrations/     # Supabase client setup
├── services/         # beaconApi.ts (AI proxy)
├── lib/              # Utilities (formatters, mockQBO)
└── test/             # Test setup

supabase/
├── functions/        # 30 Edge Functions (Gmail, GChat, RFP, AI, billing)
└── migrations/       # 150+ SQL migrations
```

## Key Commands

```bash
npm run dev          # Dev server on port 8080
npm run build        # Production build
npm run test         # Run tests (vitest, single run)
npm run test:watch   # Run tests in watch mode
npm run lint         # ESLint
```

## Architecture Patterns

### Data Fetching
Every data domain has a custom hook (e.g., `useProjects`, `useClients`, `useInvoices`) that wraps TanStack React Query with Supabase queries. Mutations use `useMutation` with `queryClient.invalidateQueries` for cache updates.

### Authentication
`AuthProvider` wraps the app. Use `useAuth()` to access `user`, `profile`, `session`. Route guards: `ProtectedRoute` (requires auth + profile), `PublicRoute`, `SetupRoute`.

### Forms
React Hook Form + Zod schemas. Dialog components handle create/edit flows (e.g., `PropertyDialog`, `ProposalDialog`).

### NYC Open Data APIs
Property lookup uses GeoSearch → PLUTO cross-verification pipeline in `useNYCPropertyLookup.ts`. DOB data fetched from:
- GeoSearch: `geosearch.planninglabs.nyc/v2/search`
- PLUTO: `data.cityofnewyork.us/resource/64uk-42ks.json`
- DOB Job Filings: `data.cityofnewyork.us/resource/ic3t-wcy2.json` (column: `bin__`)
- DOB NOW Build: `data.cityofnewyork.us/resource/rbx6-tga4.json` (column: `bin`)
- PAD (addresses): `data.cityofnewyork.us/resource/bc8t-ecyu.json`

**Important:** NYC Open Data is incomplete compared to DOB BIS (`a810-bisweb.nyc.gov`). Small/older buildings may have zero records in Open Data but show filings in BIS. The BIS website is the source of truth for DOB data.

### Edge Functions
Supabase Edge Functions handle server-side logic: Gmail sync, Google Chat webhooks, RFP extraction, AI calls, email automation. Located in `supabase/functions/`.

## Key Files

| File | Purpose |
|------|---------|
| `src/pages/PropertyDetail.tsx` | Property detail with CO tracking, DOB data import |
| `src/hooks/useNYCPropertyLookup.ts` | GeoSearch → PLUTO property resolution |
| `src/hooks/useDOBApplications.ts` | Fetches real DOB filings from NYC Open Data |
| `src/services/beaconApi.ts` | AI proxy to Beacon RAG system |
| `src/hooks/useAuth.ts` | Auth context and session management |
| `src/components/properties/co/` | Certificate of Occupancy tracking module |
| `src/components/properties/co/coMockData.ts` | Mock CO data (Queens Center Mall) — being replaced with real API calls |
| `src/pages/ProjectDetail.tsx` | Largest page (~2500 lines) — project management |

## Known Issues & Gotchas

1. **DOB data gap:** NYC Open Data APIs don't contain all records from DOB BIS. Properties may show zero filings in Ordino even when BIS shows data. Long-term fix: scrape BIS directly or use a server-side proxy.

2. **Mock CO data:** `coMockData.ts` contains hardcoded Queens Center Mall data used during development. `coImported` must default to `false` to prevent showing fake data. The Import DOB Data flow now uses real API calls.

3. **Column name quirks:** DOB Job Filings API uses `bin__` (double underscore) while DOB NOW Build uses `bin`. Always check column names per dataset.

4. **Path aliases:** `@/` maps to `src/` — configured in both `tsconfig.json` and `vite.config.ts`.

5. **Large pages:** `ProjectDetail.tsx` is ~2500 lines. Consider breaking into sub-components when modifying.

6. **Supabase types:** Generated types are in `src/integrations/supabase/types.ts`. Regenerate after migration changes.

## Testing

```bash
npm run test                              # All tests
npx vitest run src/test                   # Specific directory
npx vitest run src/test/example.test.ts   # Single file
```

Tests use JSDOM environment. Setup in `src/test/setup.ts`.

## Environment Variables

Required in `.env`:
```
VITE_SUPABASE_PROJECT_ID
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_URL
```

## Development Workflow

This project is primarily built with **Lovable** (AI-assisted development platform). Lovable has two-way GitHub sync — changes pushed to GitHub appear in Lovable and vice versa. When using Claude Code or Cursor for bug fixes:

1. Work directly on the local repo (this directory)
2. Commit and push to GitHub
3. Lovable auto-syncs the changes
4. Or: paste prompts into Lovable for feature development

## Company Context

**Green Light Expediting LLC** — NYC construction expediting firm.
- Files DOB applications (PW1, PW2, PW3, TR1, TR8)
- Resolves DOB objections
- Obtains Certificates of Occupancy
- Monitors violations and permits via CitiSignal (property monitoring feature)
- Manages client relationships, proposals, invoicing, and project lifecycle
