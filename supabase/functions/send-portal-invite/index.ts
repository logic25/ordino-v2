import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface InvitePayload {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  org_name?: string | null;
  client_org_id?: string | null;
}

const PRODUCTION_URL = 'https://ordinopm.com';
const PORTAL_CALLBACK_URL = `${PRODUCTION_URL}/auth/callback?next=${encodeURIComponent('/portal')}`;

function buildEmailHtml(args: {
  inviteeName: string;
  orgName: string;
  cleaned: string;
  actionLink: string;
}): string {
  const { inviteeName, orgName, cleaned, actionLink } = args;
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <div style="background:#1e293b;padding:20px 24px;border-radius:12px 12px 0 0">
        <h1 style="color:#f59e0b;margin:0;font-size:22px">Ordino Client Portal</h1>
      </div>
      <div style="background:#ffffff;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
        <p style="font-size:16px;color:#1e293b;margin:0 0 12px">Hi ${inviteeName},</p>
        <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 20px">
          Green Light Expediting invited you to track <strong>${orgName}</strong>'s permits in real time on the Ordino Client Portal.
        </p>
        <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 20px">
          Click below to sign in — one click, no password. This link is tied to <strong>${cleaned}</strong>.
        </p>
        <div style="text-align:center;margin:24px 0">
          <a href="${actionLink}" style="background:#1e293b;color:#f59e0b;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block">
            Sign in to your portal
          </a>
        </div>
        <p style="font-size:12px;color:#94a3b8;margin:16px 0 0;text-align:center">
          This link expires in 24 hours. If you didn't expect this invite, you can ignore this email.
        </p>
      </div>
    </div>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify the caller is signed-in staff.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: staffCheck, error: staffErr } = await admin.rpc('is_gle_staff', {
      _uid: claims.claims.sub,
    });
    if (staffErr || staffCheck !== true) {
      return new Response(JSON.stringify({ error: 'Forbidden: staff only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as InvitePayload;
    const cleaned = (body.email ?? '').trim().toLowerCase();
    if (!cleaned || !cleaned.includes('@')) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mint a magic link WITHOUT letting Supabase send its own email.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: cleaned,
      options: { redirectTo: PORTAL_CALLBACK_URL },
    });
    if (linkErr || !linkData?.properties?.action_link) {
      console.error('generateLink failed:', linkErr);
      return new Response(
        JSON.stringify({ error: 'Could not mint sign-in link', details: linkErr?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const actionLink = linkData.properties.action_link;
    const inviteeName = (body.first_name ?? '').trim() || 'there';
    const orgName = (body.org_name ?? '').trim() || 'your projects';

    // Send the branded email via the caller's Gmail connection.
    const gmailResp = await fetch(`${supabaseUrl}/functions/v1/gmail-send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        apikey: anonKey,
      },
      body: JSON.stringify({
        to: cleaned,
        subject: "You're invited to the Ordino Client Portal",
        html_body: buildEmailHtml({ inviteeName, orgName, cleaned, actionLink }),
      }),
    });

    if (!gmailResp.ok) {
      const errBody = await gmailResp.text();
      console.error(`gmail-send failed [${gmailResp.status}]: ${errBody}`);
      return new Response(
        JSON.stringify({
          error: 'Sign-in link created but email delivery failed',
          status: gmailResp.status,
          details: errBody,
          action_link: actionLink, // return so staff can copy/paste as fallback
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-portal-invite error:', err);
    return new Response(
      JSON.stringify({ error: 'Unexpected error', details: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
