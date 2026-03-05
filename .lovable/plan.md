

## Issues and Plan

### 1. "Complete PIS" link goes to "All Done" screen instead of the form

The RFI form checks if `rfi.status === "submitted"` and shows the "All Done" screen. When a reminder is sent, the PIS was already submitted, so clicking the link shows the completion screen instead of the form.

**Fix:** When the URL includes a `reminder=true` query parameter (added by the reminder email link), automatically enter edit mode instead of showing the "All Done" screen. This way:
- First-time visitors see the normal form flow
- Reminder recipients go straight to editing their responses

**Changes:**
- **`src/pages/ProjectDetail.tsx`**: Append `&reminder=true` to the PIS URL in the reminder email
- **`src/pages/RfiForm.tsx`**: Check for `reminder` search param; if present and status is `submitted`, auto-set `editingAfterSubmit = true` so it skips the "All Done" screen and goes directly to the form

### 2. Custom domain for PIS links

The PIS URL currently uses `window.location.origin`, which resolves to the Lovable preview/published domain (e.g., `ordinov3.lovable.app`). To remove the "lovable" branding from URLs, you need to connect a custom domain to this project.

You can do this in **Project Settings -> Domains** by connecting your own domain (e.g., `app.greenlightexpediting.com`). Once connected, `window.location.origin` will automatically resolve to your custom domain, and all PIS links will use it. No code changes needed -- it's purely a domain configuration step.

