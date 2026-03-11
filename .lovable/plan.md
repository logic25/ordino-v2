

## Upgrade Open Services Report Email

The email template is built entirely in `supabase/functions/send-open-services-report/index.ts` — all HTML is generated there. There's no in-app preview. The only way to see it is to trigger "Send Now" from Report Settings or wait for the scheduled send.

### Changes

**1. Add company logo + branding to header**
- Query `companies` table for `logo_url`, `address`, `phone`, `email` using the resolved `companyId`
- Replace the plain green gradient header with logo image + company address + contact line (same pattern as proposal emails)

**2. Add client name column to service table**
- Join `projects.client_id` → `clients.name` in the data query
- Add a "Client" column to the services table between Address and Service

**3. Add "Days Open" column**
- Include `services.created_at` in the query
- Calculate days since creation: `Math.ceil((Date.now() - new Date(svc.created_at)) / 86400000)`
- Add a "Days" column with color coding: green (<30), amber (30-60), red (>60)

**4. Group services by project**
- Within each PM section, group services by `project_id`
- Render a project sub-header row (project number + address + client) spanning all columns
- List services under each project without repeating project number/address

**5. Fix Gmail-incompatible CSS**
- Replace `display:flex` with `<table>` layouts for the PM stats section (Gmail strips flexbox)
- Use inline `<table>` cells for Monthly Goal, Open Value, Goal Progress, Billed, Remaining, Services

### File changed
- `supabase/functions/send-open-services-report/index.ts` — all template + query changes

### Data query update
```
.select(`
  id, name, status, fixed_price, total_amount, billed_amount, created_at,
  projects!inner (
    id, project_number, name, assigned_pm_id, status, company_id, client_id,
    properties ( address ),
    clients ( name )
  )
`)
```

