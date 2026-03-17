

## CitiSignal Complimentary Subscription Safeguards — Complete

### What was built:

**1. Database migration** ✅
- Added 6 columns to `signal_subscriptions`: `is_complimentary`, `enrolled_by`, `linked_project_id`, `monthly_rate`, `billing_start_date`, `comp_reason`

**2. useSignalSubscriptions hook updated** ✅
- Types include all new fields + joined `enrolled_by_name`, `linked_project_name`, `linked_project_phase`
- `useEnrollProperty` auto-sets `enrolled_by` to current user's profile ID
- `useSignalSubscription` fetches joined profile name and project info

**3. SignalEnrollDialog enhanced** ✅
- Complimentary toggle (only enabled when property has active projects)
- Linked project selector (required when complimentary)
- Comp reason textarea
- Monthly rate + billing start date inputs (for paid active subs)
- Trial auto-expiry (14 days), comp auto-expiry (1 year)
- Enrolled-by shown read-only on edit

**4. SignalSection updated** ✅
- Shows "Sold by: [Name]"
- Shows "Complimentary — linked to [Project Name]" or "Paid — $X/mo"
- Expiration countdown with color warnings
- Warning badge if linked project closed or no linked project on comp

**5. SignalStatusBadge updated** ✅
- Gift icon shown for complimentary subscriptions
