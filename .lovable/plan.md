
Goal: stop the complimentary flow from feeling blocked by a linked project when a property has no projects yet.

What I found:
- The database already allows `linked_project_id` to be null.
- The save mutation already sends `linked_project_id: null` when no project is selected.
- `canSubmit()` currently always returns `true`, so there is no actual frontend validation blocking save.
- The issue is the dialog UX: once “Complimentary” is turned on, it still shows a prominent “Linked Project” field, which makes it look required even though it is not.

Plan:
1. Relax the complimentary UI in `SignalEnrollDialog.tsx`
   - Rename the field to `Linked Project (optional)`.
   - Add helper copy like: “Use this if the property later becomes tied to an expediting job.”
   - When there are zero projects, replace the selector with a lightweight note instead of an empty project picker.
   - Keep the complimentary toggle fully usable even with zero projects.

2. Keep proof/accountability another way
   - Treat `comp_reason` / justification as the required explanation for why the monitoring is free.
   - Update the placeholder/copy so it captures the business reason even without a project, e.g. “Pre-sale monitoring, referral relationship, owner requested early monitoring.”

3. Adjust the subscription summary in `SignalSection.tsx`
   - If a complimentary subscription has no linked project, show neutral wording such as “Complimentary — no project linked yet” instead of a warning/error style.
   - Only show the “linked project closed — review subscription” warning when a project actually exists and is later closed.

4. Preserve the business workflow
   - Complimentary monitoring can start before a project/application exists.
   - If Ordino later wins the work, the subscription can be edited and linked to the project.
   - Expiration still remains the safety mechanism for freebies that are not converted.

Files to update:
- `src/components/properties/SignalEnrollDialog.tsx`
- `src/components/properties/SignalSection.tsx`

Expected outcome:
- Users can mark a property as complimentary without feeling forced to select a project.
- The system still tracks why it was comped and when it should expire.
- Project linkage becomes a later enrichment step, not a prerequisite.
