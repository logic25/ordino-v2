REVOKE EXECUTE ON FUNCTION public.global_search(text, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.global_search(text, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.global_search(text, int) TO authenticated;