CREATE TABLE public.mcp_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid,
  tool_name text NOT NULL,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_status text NOT NULL DEFAULT 'ok',
  error_message text,
  oauth_client_id text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mcp_audit_log_user_created ON public.mcp_audit_log (user_id, created_at DESC);
CREATE INDEX idx_mcp_audit_log_company_created ON public.mcp_audit_log (company_id, created_at DESC);
CREATE INDEX idx_mcp_audit_log_tool ON public.mcp_audit_log (tool_name, created_at DESC);

GRANT SELECT, INSERT ON public.mcp_audit_log TO authenticated;
GRANT ALL ON public.mcp_audit_log TO service_role;

ALTER TABLE public.mcp_audit_log ENABLE ROW LEVEL SECURITY;

-- Any signed-in user may insert an entry for themselves (from the MCP tool handler).
CREATE POLICY "Users can insert their own MCP audit rows"
  ON public.mcp_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins in the same company may read the log.
CREATE POLICY "Admins can view company MCP audit log"
  ON public.mcp_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
        AND (p.company_id = mcp_audit_log.company_id OR mcp_audit_log.company_id IS NULL)
    )
  );