# Add ACH Authorization Template to Invoice Settings - merge all templates into one template section for billing in settings

## What

Add an editable ACH Authorization Agreement template to the Invoice Settings page, right next to the existing Demand Letter Template section. This lets your attorney review and customize the legal language before it goes to clients.

## How It Works

- A new collapsible card called "ACH Authorization Template" will appear in Invoice Settings (between the Demand Letter and Client Billing Rules sections)
- It uses the same pattern as the demand letter: a textarea with merge field chips you can click to insert
- Merge fields like `{{company_name}}`, `{{invoice_number}}`, `{{total_amount}}`, and `{{payment_schedule}}` get auto-filled when a payment plan is created
- A "Preview" button shows a sample rendering so your attorney can see what the final document looks like
- The template saves to company settings alongside everything else

## Merge Fields Available

- `{{company_name}}` - Your company name
- `{{invoice_number}}` - The invoice being paid
- `{{total_amount}}` - Total payment plan amount
- `{{payment_schedule}}` - Auto-generated list of installment dates and amounts
- `{{effective_date}}` - Date of signing

## Technical Details

### Files to Modify

1. `**src/hooks/useCompanySettings.ts**` - Add `ach_authorization_template` to the `CompanySettings` interface
2. `**src/components/settings/InvoiceSettings.tsx**` - Add a new `CollapsibleSettingsCard` for the ACH template with:
  - Textarea for the template body
  - Clickable merge field badges (same pattern as demand letter)
  - Preview dialog with sample data
  - Saved alongside all other settings in `saveAll()`
3. `**src/components/invoices/ACHAuthorizationStep.tsx**` - Update `buildAuthText()` to use the saved template from company settings instead of the hardcoded text. Falls back to the current hardcoded version if no custom template is saved.
4. `**src/components/invoices/PaymentPlanDialog.tsx**` - Pass company settings down to `ACHAuthorizationStep` so it can use the custom template

### Default Template

The current hardcoded text in `buildAuthText()` becomes the default template that pre-fills the textarea if no custom one has been saved yet. Your attorney can then edit it freely.