## Add Rich Text Toolbar to Service Description + Explain Default Requirements

### What's Changing

**1. Rich text formatting toolbar for the Description field**

When you expand a service row, the description editor will get a formatting toolbar (similar to the reference image you shared) with:

- **Bold**, **Italic**, **Underline** buttons
- **Bullet list** and **Numbered list** buttons
- **Link** insertion

This will use the same Tiptap rich text editor (`RichTextEditor` component) that's already used in the email composer. The description will be stored as HTML, which means it can render formatted text on proposals.

The label will be changed from "Scope Description" to just **"Description"**.

The same rich text editor will also be added to the **Add New Service** dialog's description field.

**2. What are "Default Requirements"? - provide tool top explaining what this is**

Default Requirements is a feature that lets you pre-define a checklist of items needed before work on a service can begin. Each requirement has:

- **Label** -- what's needed (e.g., "Sealed plans from architect", "Owner authorization letter")
- **Category** -- the type: Missing Document, Missing Info, Pending Signature, or Pending Response
- **From Whom** -- who provides it (e.g., "Client", "Architect", "DOB")

When a service with default requirements is added to a project, the system can automatically populate a requirements checklist so the PM knows exactly what to collect. This prevents projects from stalling because someone forgot to request a critical document.

---

### Technical Details

**Files to modify:**

1. `**src/components/settings/ServiceCatalogSettings.tsx**`
  - Import `RichTextEditor` from `@/components/emails/RichTextEditor`
  - In the expanded description row (lines 413-428): replace the `Textarea` with `RichTextEditor`, passing `service.description` as content and updating via `updateService(service.id, "description", html)`
  - Change label from "Scope Description" to "Description"
  - In the Add Service dialog (lines 593-602): replace the `Textarea` with `RichTextEditor` for the new service description field
2. `**src/hooks/useCompanySettings.ts**` -- No changes needed; `description` is already a `string` field that can hold HTML.
3. `**src/components/emails/RichTextEditor.tsx**` -- No changes needed; the existing component already supports bold, italic, underline, links, bullet lists, and numbered lists.