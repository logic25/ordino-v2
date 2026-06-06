# Data-model naming gotchas

## "Companies" (UI) ≠ `companies` (table)

There are two distinct "company" concepts. Confusing them causes real bugs (wrong
RLS, wrong FK, wrong joins).

| What you see / write | Maps to | Meaning |
|---|---|---|
| Sidebar **"Companies"**, route **`/clients`**, page `<h1>Companies</h1>` | table **`clients`** | A customer/partner organization the firm works with — GCs, owners, architects, SIAs, RFP/referral partners. May or may not be a paying client. |
| *(never shown to users)* | table **`companies`** | The **tenant** — the expediting firm using Ordino. This is the `company_id` multi-tenancy / RLS boundary on nearly every table. |

So in code:
- The "Companies" section is backed by **`clients`** (`useClients`, `/clients`, `ClientDetail`).
- `companies` is the tenant; you almost never query it directly — you scope by
  `company_id` via `public.is_company_member(company_id)` in RLS.
- A person at a Company is a **`client_contacts`** row (`is_referrer`, `is_primary`, etc.).

The "Companies" label is intentional and correct for users (matches HubSpot's CRM
vocabulary, and covers non-client orgs like referral partners). We do **not** rename
the `companies` or `clients` tables — `company_id` is load-bearing everywhere.

## BD Leads → Company conversion

A Lead's free-text `company` becomes a `clients` row ("Company") at **Create Proposal
from Lead** (see BD Sprint 2). The flow find-or-creates the `clients` row, links it via
`leads.client_id` + `proposals.client_id`, and the existing Proposal→Project conversion
(`useSignProposalInternal`) carries `client_id` forward to the project. Leads are not
auto-converted at capture time — only once you seriously engage (stage ≥ QUALIFIED).
