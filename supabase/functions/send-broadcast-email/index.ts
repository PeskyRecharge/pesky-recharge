import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const adminEmail = Deno.env.get("ADMIN_EMAIL")?.toLowerCase();
  const sendgridFromEmail = Deno.env.get("SENDGRID_FROM_EMAIL");
  if (!supabaseUrl || !serviceRoleKey || !adminEmail || !sendgridFromEmail) {
    return json({ error: "The email function is not fully configured." }, 500);
  }

  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Authentication required. Please sign in as the admin user." }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  if (userError || userData.user?.email?.toLowerCase() !== adminEmail) {
    return json({ error: "Only the configured admin can send broadcasts." }, 403);
  }

  const body = await request.json().catch(() => null) as { subject?: unknown; message?: unknown } | null;
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!subject || !message || subject.length > 150 || message.length > 10000) {
    return json({ error: "Provide a subject and message within the allowed length." }, 400);
  }

  const { data: sendgridSecret, error: secretError } = await adminClient.rpc("get_sendgrid_api_key");
  if (secretError || !sendgridSecret) return json({ error: "SENDGRID_API_KEY could not be read from Vault." }, 500);

  const { data: customers, error: customerError } = await adminClient
    .from("customers")
    .select("email")
    .not("email", "is", null);
  if (customerError) return json({ error: "Could not load customer emails." }, 500);

  let sent = 0;
  let failed = 0;
  for (const customer of customers || []) {
    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${sendgridSecret}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: customer.email }] }],
          from: { email: sendgridFromEmail, name: "Pesky Recharge" },
          subject,
          content: [{ type: "text/plain", value: message }],
        }),
      });

      const responseText = await response.text();
      if (response.ok) {
        sent += 1;
      } else {
        console.error(`SendGrid failed for ${customer.email}:`, response.status, responseText);
        failed += 1;
      }
    } catch (error) {
      console.error(`SendGrid exception for ${customer.email}:`, error);
      failed += 1;
    }
  }

  return json({ sent, failed, total: (customers || []).length });
});
