-- Grant missing privileges on widget_messages so soft-delete (UPDATE) works.
-- Without this, the "Delete chat" and "Clear all chats" actions silently fail
-- and messages reappear on next load.
GRANT SELECT, INSERT, UPDATE ON public.widget_messages TO authenticated;
GRANT ALL ON public.widget_messages TO service_role;