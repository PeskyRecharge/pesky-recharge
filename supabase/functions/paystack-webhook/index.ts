import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function isValidPaystackSignature(
  body: string,
  signature: string | null,
  secret: string,
) {
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(body)),
  );
  const expected = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  let difference = 0;
  for (let index = 0; index < expected.length; index++) {
    difference |= expected.charCodeAt(index) ^ signature.toLowerCase().charCodeAt(index);
  }
  return difference === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!paystackSecret || !supabaseUrl || !serviceRoleKey) {
    console.error("Required webhook environment variable is missing");
    return jsonResponse({ error: "Webhook is not configured" }, 500);
  }

  const rawBody = await req.text();
  const validSignature = await isValidPaystackSignature(
    rawBody,
    req.headers.get("x-paystack-signature"),
    paystackSecret,
  );

  if (!validSignature) {
    console.warn("Rejected webhook with invalid Paystack signature");
    return jsonResponse({ error: "Invalid webhook signature" }, 401);
  }

  let payload: {
    event?: string;
    data?: {
      reference?: string;
      amount?: number;
    };
  };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Invalid JSON payload" }, 400);
  }

  if (payload.event !== "charge.success") {
    return jsonResponse({ received: true });
  }

  const reference = payload.data?.reference;
  if (!reference) {
    return jsonResponse({ error: "Missing transaction reference" }, 400);
  }

  try {
    const verificationResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${paystackSecret}` } },
    );
    const verification = await verificationResponse.json();

    if (
      !verificationResponse.ok ||
      verification.status !== true ||
      verification.data?.status !== "success" ||
      verification.data?.reference !== reference
    ) {
      console.error("Paystack transaction verification failed", {
        reference,
        status: verification.data?.status,
        message: verification.message,
      });
      return jsonResponse({ error: "Payment could not be verified" }, 400);
    }

    const payment = verification.data;
    const amountInKobo = Number(payment.amount);
    const eventAmountInKobo = Number(payload.data?.amount);
    const userId = payment.metadata?.userId;

    if (
      !Number.isSafeInteger(amountInKobo) ||
      amountInKobo <= 0 ||
      amountInKobo !== eventAmountInKobo ||
      payment.currency !== "NGN" ||
      typeof userId !== "string" ||
      !userId
    ) {
      console.error("Verified Paystack transaction has invalid deposit details", {
        reference,
        amountInKobo,
        eventAmountInKobo,
        currency: payment.currency,
      });
      return jsonResponse({ error: "Invalid payment details" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: result, error } = await supabase.rpc(
      "process_paystack_deposit",
      {
        p_user_id: userId,
        p_reference: reference,
        p_amount: amountInKobo / 100,
        p_payment_method: payment.channel || "unknown",
      },
    );

    if (error) {
      console.error("Atomic deposit processing failed", { reference, error });
      return jsonResponse({ error: "Unable to credit wallet" }, 500);
    }

    console.log("Paystack deposit processed", { reference, userId, result });
    return jsonResponse({ success: true, result });
  } catch (error) {
    console.error("Webhook processing error", error);
    return jsonResponse({ error: "Webhook processing failed" }, 500);
  }
});