

# Auto-Create Services When Change Order Is Approved

## Current State

The dual-signature approval flow **already works**:
- When the client signs a CO on the public page (`/change-order/:token`), the status is automatically set to "approved" with `approved_at` timestamped.
- Internally, there's a `useMarkCOApproved` hook for manual approval.
- The `co_timeline_trigger` database function already logs a timeline event when status changes to "approved."

**What's missing**: When a CO becomes "approved," its line items do NOT automatically appear as billable services in the project. PMs have to manually recreate them.

## What This Plan Adds

When a CO is approved (by either path), its line items automatically become services in the project -- available for the standard "Send to Billing" workflow.

---

## Technical Details

### 1. Database Migration: Add `change_order_id` to `services` table

Add a nullable UUID column linking a service back to its source change order:

```sql
ALTER TABLE public.services
ADD COLUMN change_order_id uuid REFERENCES public.change_orders(id) ON DELETE SET NULL;
```

This enables:
- Preventing duplicate services if a CO is re-approved (check for existing services with that `change_order_id`)
- UI can show a "CO#X" badge on services that originated from change orders

### 2. Database Trigger: Auto-create services on CO approval

Create a trigger function that fires when `change_orders.status` changes to `approved`. This runs at the database level so it works regardless of whether the client signs on the public page or an internal user manually approves:

```sql
CREATE OR REPLACE FUNCTION public.create_services_from_approved_co()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item jsonb;
  app_id uuid;
BEGIN
  -- Only fire when status changes to approved
  IF NEW.status != 'approved' OR (OLD.status IS NOT NULL AND OLD.status = 'approved') THEN
    RETURN NEW;
  END IF;

  -- Skip if services already exist for this CO (idempotency)
  IF EXISTS (SELECT 1 FROM public.services WHERE change_order_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Find the first DOB application for this project (required FK)
  SELECT id INTO app_id
  FROM public.dob_applications
  WHERE project_id = NEW.project_id
  LIMIT 1;

  -- If no application exists, create services with project_id only
  IF NEW.line_items IS NOT NULL AND jsonb_array_length(NEW.line_items::jsonb) > 0 THEN
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.line_items::jsonb) LOOP
      INSERT INTO public.services (
        company_id, project_id, application_id,
        name, description, fixed_price, total_amount,
        billing_type, status, change_order_id
      ) VALUES (
        NEW.company_id, NEW.project_id, app_id,
        'CO#' || SUBSTRING(NEW.co_number FROM 4) || ' - ' || (item->>'name'),
        COALESCE(item->>'description', NEW.description),
        COALESCE((item->>'amount')::numeric, 0),
        COALESCE((item->>'amount')::numeric, 0),
        'fixed', 'not_started', NEW.id
      );
    END LOOP;
  ELSE
    -- CO has no line items array, use single amount
    INSERT INTO public.services (
      company_id, project_id, application_id,
      name, description, fixed_price, total_amount,
      billing_type, status, change_order_id
    ) VALUES (
      NEW.company_id, NEW.project_id, app_id,
      'CO#' || SUBSTRING(NEW.co_number FROM 4) || ' - ' || NEW.title,
      NEW.description,
      NEW.amount, NEW.amount,
      'fixed', 'not_started', NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_co_create_services
AFTER UPDATE ON public.change_orders
FOR EACH ROW
EXECUTE FUNCTION public.create_services_from_approved_co();
```

### 3. Update Services UI: Show CO Badge

In the project's services table, services with a non-null `change_order_id` will display a small "CO" badge next to the service name. This is a minor visual change to the existing service row rendering in `ProjectExpandedTabs.tsx` (or wherever the services table renders).

### 4. Remove `useMarkCOApproved` Service Creation from Hook

Since the database trigger now handles service creation automatically, the `useMarkCOApproved` hook in `useChangeOrders.ts` stays as-is (it just sets status to "approved," and the trigger does the rest). No changes needed there.

---

## Files Changed

| Action | File |
|--------|------|
| Migration | Add `change_order_id` column to `services` + create trigger function |
| Modify | `src/pages/ProjectDetail.tsx` or services table component -- add CO badge for CO-sourced services |

This is a clean, minimal approach: one migration adds the column and trigger, and the services appear automatically no matter how the CO gets approved (client signature, internal approval, or any future path).
