import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const networkIds: Record<string, number> = {
  MTN: 1,
  GLO: 2,
  "9MOBILE": 3,
  AIRTEL: 4,
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function numberValue(...values: unknown[]) {
  for (const value of values) {
    const number = typeof value === "string"
      ? Number(value.replace(/[^0-9.]/g, ""))
      : Number(value);

    if (Number.isFinite(number) && number > 0) return number;
  }

  return 0;
}

function calculateMarkup(providerPrice: number) {
  if (providerPrice <= 100) return 20;
  if (providerPrice <= 200) return 56;
  if (providerPrice <= 500) return 60;
  if (providerPrice <= 1000) return 80;
  if (providerPrice <= 2000) return 120;
  return 150;
}

function normalizePlan(plan: Record<string, unknown>) {
  const dataPlan = numberValue(
    plan.data_plan,
    plan.dataPlan,
    plan.plan_id,
    plan.planId,
    plan.id,
  );

  const name = String(
    plan.name || plan.plan_name || plan.planName || plan.title || "",
  ).trim();

  const providerPrice = numberValue(
    plan.api_user_price,
    plan.price,
    plan.selling_price,
    plan.sellingPrice,
    plan.amount,
    plan.cost,
  );

  const validity = String(plan.validity || plan.duration || "").trim();
  const dataType = String(plan.data_type || plan.dataType || "").trim();
  const markup = calculateMarkup(providerPrice);

  return {
    data_plan: dataPlan,
    name,
    provider_price: providerPrice,
    price: providerPrice + markup,
    markup,
    validity,
    data_type: dataType,
  };
}

function extractPlans(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 5 || value === null || typeof value !== "object") return [];

  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object" && !Array.isArray(item))
    );
  }

  const object = value as Record<string, unknown>;

  for (const key of ["plans", "data", "results", "items", "packages"]) {
    const plans = extractPlans(object[key], depth + 1);
    if (plans.length) return plans;
  }

  return [];
}

function providerMessage(data: unknown, status: number) {
  if (data && typeof data === "object") {
    const object = data as Record<string, unknown>;

    for (const key of ["message", "detail", "error_description"]) {
      if (typeof object[key] === "string" && object[key].trim()) {
        return object[key].trim();
      }
    }
  }

  return `IA-Café returned HTTP ${status}`;
}

function providerSucceeded(data: unknown) {
  if (!data || typeof data !== "object") return false;

  const object = data as Record<string, unknown>;
  const nested = object.data && typeof object.data === "object"
    ? object.data as Record<string, unknown>
    : {};

  const code = String(object.code || "").toLowerCase();

  return code === "success" || [
    "success",
    "successful",
    "completed",
    "completed-api",
    "complete",
  ].includes(status);
}

async function readJson(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) as unknown : null;
  } catch {
    return { raw: text.slice(0, 2000) };
  }
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ success: false, message: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("PROJECT_URL") || Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const apiKey = Deno.env.get("IACAFE_API_KEY");
    const configuredUrl = Deno.env.get("IACAFE_DATA_URL") || "https://iacafe.com.ng/devapi/v1/budget-data";

    if (!supabaseUrl || !serviceRoleKey || !apiKey) {
      return jsonResponse({ success: false, message: "Data service is not configured" }, 500);
    }

    const authorization = request.headers.get("Authorization") || "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();

    if (!accessToken) {
      return jsonResponse({ success: false, message: "Authentication required" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken);

    if (userError || !userData.user) {
      return jsonResponse({ success: false, message: "Invalid or expired session" }, 401);
    }

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const action = String(body?.action || "purchase").toLowerCase();
    const network = String(body?.network || "").toUpperCase();
    const networkId = networkIds[network];
    const phone = String(body?.phone || "").replace(/\D/g, "");
    const requestedPlan = numberValue(body?.data_plan, body?.dataPlan);

    if (!networkId) {
      return jsonResponse({ success: false, message: "Invalid network" }, 400);
    }

    const baseUrl = configuredUrl.replace(/\/$/, "");
    const purchaseUrl = baseUrl.endsWith("/plans") ? baseUrl.slice(0, -6) : baseUrl;
    const plansUrl = `${purchaseUrl}/plans`;

    const plansResponse = await fetch(`${plansUrl}?network_id=${networkId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-API-Key": apiKey,
        Accept: "application/json",
      },
    });

    const plansData = await readJson(plansResponse);

    if (!plansResponse.ok) {
      console.error("IA-Café plans response:", plansData);
      return jsonResponse({
        success: false,
        message: providerMessage(plansData, plansResponse.status),
        providerResponse: plansData,
      }, 502);
    }

    const plans = extractPlans(plansData)
      .map(normalizePlan)
      .filter((plan) => plan.data_plan > 0 && plan.name && plan.provider_price > 0);

    if (!plans.length) {
      console.error("IA-Café returned no usable plans:", plansData);
      return jsonResponse({
        success: false,
        message: `No usable IA-Café plans were returned for ${network}`,
        providerResponse: plansData,
      }, 502);
    }

    if (action === "plans") {
      return jsonResponse({ success: true, network, networkId, plans });
    }

    if (!/^0[789][01]\d{8}$/.test(phone)) {
      return jsonResponse({ success: false, message: "Invalid Nigerian phone number" }, 400);
    }

    if (!requestedPlan) {
      return jsonResponse({ success: false, message: "A valid data_plan is required" }, 400);
    }

    const selectedPlan = plans.find((plan) => plan.data_plan === requestedPlan);

    if (!selectedPlan) {
      return jsonResponse({
        success: false,
        message: "Selected data plan is not available for this network",
        availablePlans: plans,
      }, 400);
    }

    const { data: customer, error: customerError } = await adminClient
      .from("customers")
      .select("balance, transactions")
      .eq("auth_id", userData.user.id)
      .single();

    if (customerError || !customer) {
      return jsonResponse({ success: false, message: "Customer not found" }, 404);
    }

    const balance = Number(customer.balance || 0);

    if (balance < selectedPlan.price) {
      return jsonResponse({ success: false, message: "Insufficient balance" }, 400);
    }

    const requestId = `bd_${network.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const providerResponse = await fetch(purchaseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        request_id: requestId,
        phone,
        data_plan: selectedPlan.data_plan,
        network_id: networkId,
      }),
    });

    const providerData = await readJson(providerResponse);

    console.log("IA-Café Budget Data result:", {
      status: providerResponse.status,
      requestId,
      network,
      providerData,
    });

    if (!providerResponse.ok || !providerSucceeded(providerData)) {
      return jsonResponse({
        success: false,
        message: providerMessage(providerData, providerResponse.status),
        providerResponse: providerData,
      }, 502);
    }

    let transactions: unknown[] = [];

    if (Array.isArray(customer.transactions)) {
      transactions = customer.transactions;
    } else if (typeof customer.transactions === "string") {
      try {
        const parsed = JSON.parse(customer.transactions);
        if (Array.isArray(parsed)) transactions = parsed;
      } catch {
        transactions = [];
      }
    }

    const newBalance = balance - selectedPlan.price;

    transactions.push({
      type: "data",
      bundle_id: String(selectedPlan.data_plan),
      bundle: selectedPlan.name,
      data_plan: selectedPlan.data_plan,
      provider_price: selectedPlan.provider_price,
      amount: selectedPlan.price,
      markup: selectedPlan.markup,
      phone,
      network,
      reference: requestId,
      date: new Date().toISOString(),
    });

    const { error: updateError } = await adminClient
      .from("customers")
      .update({ balance: newBalance, transactions })
      .eq("auth_id", userData.user.id);

    if (updateError) {
      console.error("Balance update error:", updateError);
      return jsonResponse({
        success: false,
        message: "Data was sent, but balance update failed",
      }, 500);
    }

    return jsonResponse({
      success: true,
      newBalance,
      providerPrice: selectedPlan.provider_price,
      markup: selectedPlan.markup,
      chargedAmount: selectedPlan.price,
      reference: requestId,
      bundle: selectedPlan.name,
      dataPlan: selectedPlan.data_plan,
      message: `${selectedPlan.name} sent successfully to ${phone}`,
    });
  } catch (error) {
    console.error("Data function error:", error);
    return jsonResponse({ success: false, message: "Data service error" }, 500);
  }
});
