import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

const serviceIds: Record<string, string> = {
  MTN: "mtn",
  GLO: "glo",
  AIRTEL: "airtel",
  "9MOBILE": "9mobile",
};

const airtimePrices: Record<number, number> = {
  100: 98,
  200: 196,
  500: 490,
  1000: 980,
  2000: 1960,
  5000: 4900,
};

function getProviderMessage(providerData: unknown, status: number) {
  if (providerData && typeof providerData === "object") {
    const data = providerData as Record<string, unknown>;
    const providerError = data.error;

    if (providerError && typeof providerError === "object") {
      const error = providerError as Record<string, unknown>;
      if (typeof error.message === "string" && error.message.trim()) {
        return error.message.trim();
      }
    }

    for (const key of ["message", "detail", "error_description"]) {
      if (typeof data[key] === "string" && data[key].trim()) {
        return data[key].trim();
      }
    }
  }

  return `IACAFE rejected the request (HTTP ${status}).`;
}

function providerSucceeded(providerData: unknown) {
  if (!providerData || typeof providerData !== "object") return false;

  const data = providerData as Record<string, unknown>;
  const status = String(data.status || data.code || "").toLowerCase();

  return data.success === true || [
    "success",
    "successful",
    "completed",
    "complete",
  ].includes(status);
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ success: false, message: "Method not allowed" }, 405);
  }

  try {
    const authorization = request.headers.get("Authorization") || "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();

    if (!accessToken) {
      return jsonResponse({
        success: false,
        message: "Authentication required",
      }, 401);
    }

    const supabaseUrl = Deno.env.get("PROJECT_URL") || Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const iacafeApiKey = Deno.env.get("IACAFE_API_KEY");
    const iacafeAirtimeUrl = Deno.env.get("IACAFE_AIRTIME_URL");

    if (!supabaseUrl || !serviceRoleKey || !iacafeApiKey || !iacafeAirtimeUrl) {
      console.error("Missing required secrets", {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
        hasIacafeApiKey: Boolean(iacafeApiKey),
        hasIacafeAirtimeUrl: Boolean(iacafeAirtimeUrl),
      });

      return jsonResponse({
        success: false,
        message: "Airtime service is not configured",
      }, 500);
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(iacafeAirtimeUrl);
      if (!/^https?:$/.test(parsedUrl.protocol)) throw new Error("Invalid protocol");
    } catch {
      console.error("IACAFE_AIRTIME_URL is not a valid HTTP(S) URL");
      return jsonResponse({
        success: false,
        message: "Airtime provider URL is invalid",
      }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken);

    if (userError || !userData.user) {
      return jsonResponse({
        success: false,
        message: "Invalid or expired session",
      }, 401);
    }

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const phone = String(body?.phone || "").replace(/\D/g, "");
    const network = String(body?.network || "").toUpperCase();
    const amount = Number(body?.amount);
    const charge = airtimePrices[amount];

    if (!/^0[789][01]\d{8}$/.test(phone)) {
      return jsonResponse({
        success: false,
        message: "Invalid Nigerian phone number",
      }, 400);
    }

    if (
      !serviceIds[network] ||
      !Number.isInteger(amount) ||
      charge === undefined
    ) {
      return jsonResponse({
        success: false,
        message: "Invalid network or airtime amount",
      }, 400);
    }

    const { data: customer, error: customerError } = await adminClient
      .from("customers")
      .select("balance, transactions")
      .eq("auth_id", userData.user.id)
      .single();

    if (customerError || !customer) {
      console.error("Customer lookup error:", customerError);
      return jsonResponse({
        success: false,
        message: "Customer not found",
      }, 404);
    }

    const balance = Number(customer.balance || 0);
    if (balance < charge) {
      return jsonResponse({
        success: false,
        message: "Insufficient balance",
      }, 400);
    }

    const requestId = `a${Date.now().toString(36)}${crypto.randomUUID().replaceAll("-", "").slice(0, 4)}`;
    const providerPayload = {
      request_id: requestId,
      service_id: serviceIds[network],
      phone,
      amount,
    };

    const providerResponse = await fetch(parsedUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${iacafeApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(providerPayload),
    });

    const providerRaw = await providerResponse.text();
    let providerData: unknown = null;

    try {
      providerData = providerRaw ? JSON.parse(providerRaw) : null;
    } catch {
      providerData = { raw: providerRaw.slice(0, 1000) };
    }

    console.log("IACAFE airtime result:", {
      status: providerResponse.status,
      endpoint: parsedUrl.origin + parsedUrl.pathname,
      payload: providerPayload,
      response: providerData,
    });

    if (!providerResponse.ok || !providerSucceeded(providerData)) {
      return jsonResponse({
        success: false,
        message: getProviderMessage(providerData, providerResponse.status),
      }, 502);
    }

    let transactions: unknown = customer.transactions || [];
    if (typeof transactions === "string") {
      try {
        transactions = JSON.parse(transactions);
      } catch {
        transactions = [];
      }
    }
    if (!Array.isArray(transactions)) transactions = [];

    const newBalance = balance - charge;
    const airtimeTransaction = {
      type: "airtime",
      amount,
      charge,
      phone,
      network,
      date: new Date().toISOString(),
      reference: requestId,
    };

    const { error: updateError } = await adminClient
      .from("customers")
      .update({
        balance: newBalance,
        transactions: [...transactions, airtimeTransaction],
      })
      .eq("auth_id", userData.user.id);

    if (updateError) {
      console.error("Balance update error:", updateError);
      return jsonResponse({
        success: false,
        message: "Airtime was sent, but balance update needs support",
      }, 500);
    }

    return jsonResponse({
      success: true,
      newBalance,
      reference: requestId,
      amount,
      chargedAmount: charge,
      message: `₦${amount} airtime sent successfully to ${phone}. Charged ₦${charge}.`,
    });
  } catch (error) {
    console.error("Airtime function error:", error);
    return jsonResponse({
      success: false,
      message: "Airtime service error",
    }, 500);
  }
});
