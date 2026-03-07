

## Remove AI Suggest Fix from Bug Reports

Remove the "AI Auto-Fix / Suggest Fix" feature from the bug report detail sheet since "Copy for Lovable" is the more effective workflow (it has full codebase access).

### Changes — `src/components/helpdesk/BugReports.tsx`

1. **Remove state variables** (lines 88-89): `aiSuggestion`, `aiLoading`
2. **Remove `setAiSuggestion("")`** from `openDetail` (line 219)
3. **Remove `suggestFix` function** (lines 240-261)
4. **Remove `approveFix` function** (lines 282-290)
5. **Remove the entire AI Suggest Fix UI block** (lines 662-688) — the bordered card with the Suggest Fix button, suggestion display, and Approve/Dismiss buttons
6. **Clean up unused imports** if `Sparkles` and `Loader2` are no longer referenced elsewhere in the file

No other files need changes. The "Copy for Lovable" button remains untouched.

