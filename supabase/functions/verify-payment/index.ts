import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, message: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const reference = body?.reference;
    const userId = body?.userId;
    const requestedAmount = Number(body?.amount);

    if (
      typeof reference !== "string" ||
      !reference.trim() ||
      typeof userId !== "string" ||
      !userId
    ) {
      return jsonResponse({
        success: false,
        message: "Reference and userId are required",
      }, 400);
    }

    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!paystackSecret || !supabaseUrl || !serviceRoleKey) {
      console.error("Required payment verification environment variable is missing");
      return jsonResponse({
        success: false,
        message: "Payment verification is not configured",
      }, 500);
    }

    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${paystackSecret}` } },
    );
    const verification = await paystackResponse.json();
    const payment = verification?.data;

    if (
      !paystackResponse.ok ||
      verification?.status !== true ||
      payment?.status !== "success" ||
      payment?.reference !== reference
    ) {
      return jsonResponse({
        success: false,
        message: "Payment could not be verified as successful",
      }, 400);
    }

    const amountInKobo = Number(payment.amount);
    const requestedAmountInKobo = Math.round(requestedAmount * 100);

    if (
      !Number.isSafeInteger(amountInKobo) ||
      amountInKobo <= 0 ||
      !Number.isFinite(requestedAmount) ||
      requestedAmount <= 0 ||
      amountInKobo !== requestedAmountInKobo ||
      payment.currency !== "NGN" ||
      payment.metadata?.userId !== userId
    ) {
      return jsonResponse({
        success: false,
        message: "Payment details do not match this deposit",
      }, 400);
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
      return jsonResponse({
        success: false,
        message: "Unable to credit wallet",
      }, 500);
    }

    console.log("Payment verified and deposit processed", {
      reference,
      userId,
      result,
    });

    return jsonResponse({
      success: true,
      message: result?.already_processed
        ? "Deposit already processed"
        : "Payment verified and wallet credited",
      reference,
      amount: amountInKobo / 100,
      result,
    });
  } catch (error) {
    console.error("Verify payment error:", error);
    return jsonResponse({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error",
    }, 500);
  }
});