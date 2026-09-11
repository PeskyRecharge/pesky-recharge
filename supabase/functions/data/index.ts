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

const bundlePatterns: Record<string, RegExp> = {
  "100MB": /(^|[^0-9])100\s*MB\b/i,
  "200MB": /(^|[^0-9])200\s*MB\b/i,
  "500MB": /(^|[^0-9])500\s*MB\b/i,
  "1GB": /(^|[^0-9])1\s*GB\b/i,
  "2GB": /(^|[^0-9])2\s*GB\b/i,
  "3GB": /(^|[^0-9])3\s*GB\b/i,
  "5GB": /(^|[^0-9])5\s*GB\b/i,
  "7GB": /(^|[^0-9])7\s*GB\b/i,
  "10GB": /(^|[^0-9])10\s*GB\b/i,
  "20GB": /(^|[^0-9])20\s*GB\b/i,
  "30GB": /(^|[^0-9])30\s*GB\b/i,
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

function providerMessage(providerData: unknown, status: number) {
  if (providerData && typeof providerData === "object") {
    const data = providerData as Record<string, unknown>;

    for (const key of ["message", "detail", "error_description"]) {
      if (typeof data[key] === "string" && data[key].trim()) {
        return data[key].trim();
      }
    }

    if (data.error && typeof data.error === "object") {
      const error = data.error as Record<string, unknown>;
      if (typeof error.message === "string" && error.message.trim()) {
        return error.message.trim();
      }
    }
  }

  return `IACAFE rejected the request (HTTP ${status}).`;
}

function isSuccessful(providerData: unknown) {
  if (!providerData || typeof providerData !== "object") {
    return false;
  }

  const data = providerData as Record<string, unknown>;
  const nestedData = data.data && typeof data.data === "object"
    ? data.data as Record<string, unknown>
    : null;
  const code = String(data.code || "").toLowerCase();
  const status = String(nestedData?.status || data.status || "").toLowerCase();

  return code === "success" || [
    "success",
    "successful",
    "completed",
    "completed-api",
    "complete",
  ].includes(status);
}

async function readJson(response: Response) {
  const raw = await response.text();

  try {
    return raw ? JSON.parse(raw) as unknown : null;
  } catch {
    return { raw: raw.slice(0, 1000) };
  }
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const number = typeof value === "string"
      ? Number(value.replace(/[^0-9.]/g, ""))
      : Number(value);
    if (Number.isFinite(number) && number > 0) {
      return number;
    }
  }

  return 0;
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({
      success: false,
      message: "Method not allowed",
    }, 405);
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

    const supabaseUrl =
      Deno.env.get("PROJECT_URL") ||
      Deno.env.get("SUPABASE_URL");
    const serviceRoleKey =
      Deno.env.get("SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const iacafeApiKey = Deno.env.get("IACAFE_API_KEY");
    const configuredDataUrl = Deno.env.get("IACAFE_DATA_URL") ||
      "https://iacafe.com.ng/devapi/v1/budget-data";

    if (!supabaseUrl || !serviceRoleKey || !iacafeApiKey) {
      console.error("Missing required data service secrets");
      return jsonResponse({
        success: false,
        message: "Data service is not configured",
      }, 500);
    }

    const dataUrl = configuredDataUrl.replace(/\/$/, "");
    const purchaseUrl = dataUrl.endsWith("/plans")
      ? dataUrl.slice(0, -6)
      : dataUrl;
    const plansUrl = `${purchaseUrl}/plans`;

    try {
      if (!/^https?:$/.test(new URL(purchaseUrl).protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return jsonResponse({
        success: false,
        message: "Data provider URL is invalid",
      }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: userData, error: userError } =
      await adminClient.auth.getUser(accessToken);

    if (userError || !userData.user) {
      return jsonResponse({
        success: false,
        message: "Invalid or expired session",
      }, 401);
    }

    const body = await request.json().catch(() => null) as
      | Record<string, unknown>
      | null;
    const phone = String(body?.phone || "").replace(/\D/g, "");
    const network = String(body?.network || "").toUpperCase();
    const bundleId = String(body?.bundleId || "").toUpperCase();
    const bundleName = String(body?.bundleName || "").trim();
    const plansRequest = body?.action === "plans";
    const networkId = networkIds[network];
    const bundlePattern = bundlePatterns[bundleId];
    const requiresExactPlan = network === "GLO";

    console.log("Data request received", {
      action: body?.action || "purchase",
      network,
      bundleId,
      bundleName,
      hasPhone: Boolean(phone),
    });

    if (!plansRequest && !/^0[789][01]\d{8}$/.test(phone)) {
      return jsonResponse({
        success: false,
        message: "Invalid Nigerian phone number",
      }, 400);
    }

    if (
      !networkId ||
      (!plansRequest && (
        requiresExactPlan
          ? !bundleName
          : !bundlePattern && !bundleName
      ))
    ) {
      return jsonResponse({
        success: false,
        message: "Invalid network or data bundle",
      }, 400);
    }

    const plansResponse = await fetch(
      `${plansUrl}?network_id=${networkId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${iacafeApiKey}`,
          "X-API-Key": iacafeApiKey,
          Accept: "application/json",
        },
      },
    );
    const plansData = await readJson(plansResponse);

    if (!plansResponse.ok || !plansData || typeof plansData !== "object") {
      return jsonResponse({
        success: false,
        message: providerMessage(plansData, plansResponse.status),
      }, 502);
    }

    const plansRoot = plansData as Record<string, unknown>;
    const plansContainer = plansRoot.data && typeof plansRoot.data === "object"
      ? plansRoot.data as Record<string, unknown>
      : null;
    const plansValue = Array.isArray(plansContainer)
      ? plansContainer
      : Array.isArray(plansContainer?.plans)
        ? plansContainer.plans
        : Array.isArray(plansRoot.plans)
          ? plansRoot.plans
          : [];
    let plans = plansValue as Record<string, unknown>[];

    if (!plans.length) {
      console.error("IACAFE returned no data plans", {
        status: plansResponse.status,
        response: plansData,
        network,
        networkId,
      });

      return jsonResponse({
        success: false,
        message: providerMessage(plansData, plansResponse.status) ===
          `IACAFE rejected the request (HTTP ${plansResponse.status}).`
          ? `No live IACAFE data plans were returned for ${network}.`
          : providerMessage(plansData, plansResponse.status),
      }, 502);
    }

    if (plansRequest) {
      return jsonResponse({
        success: true,
        plans: plans.map((plan) => ({
          name: String(plan.name || ""),
          price: Number(plan.price || 0),
        })).filter((plan) => plan.name && Number.isFinite(plan.price) && plan.price > 0),
      });
    }

    const selectedPlan = plans.find((plan) =>
      bundleName
        ? String(plan.name || "").trim() === bundleName
        : bundlePattern.test(String(plan.name || ""))
    );
    const dataPlan = firstNumber(
      selectedPlan?.data_plan,
      selectedPlan?.dataPlan,
      selectedPlan?.plan_id,
      selectedPlan?.planId,
      selectedPlan?.id,
    );
    const charge = firstNumber(
      selectedPlan?.price,
      selectedPlan?.selling_price,
      selectedPlan?.sellingPrice,
      selectedPlan?.amount,
      selectedPlan?.cost,
    );
    const bundleLabel = String(selectedPlan?.name || bundleId);

    if (!selectedPlan || !Number.isInteger(dataPlan) || !Number.isFinite(charge) || charge <= 0) {
      console.error("Invalid selected AICAFE plan", {
        requestedBundleName: bundleName,
        selectedPlan,
        selectedPlanKeys: selectedPlan ? Object.keys(selectedPlan) : [],
        dataPlan,
        charge,
      });
      const availablePlans = plans
        .map((plan) => String(plan.name || ""))
        .filter(Boolean)
        .join(", ");

      return jsonResponse({
        success: false,
        message: availablePlans
          ? `This bundle is not available for ${network}. Available plans: ${availablePlans}`
          : `No data plans were returned for ${network}`,
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

    const requestId =
      `d_${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
    const providerPayload = {
      request_id: requestId,
      phone,
      data_plan: dataPlan,
      network_id: networkId,
    };

    const providerResponse = await fetch(purchaseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${iacafeApiKey}`,
        "X-API-Key": iacafeApiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(providerPayload),
    });
    const providerData = await readJson(providerResponse);

    console.log("IACAFE Budget Data result:", {
      status: providerResponse.status,
      requestId,
      providerPayload,
      providerData,
    });

    if (!providerResponse.ok || !isSuccessful(providerData)) {
      return jsonResponse({
        success: false,
        message: providerMessage(providerData, providerResponse.status),
      }, 502);
    }

    let transactions: unknown[] = [];

    if (Array.isArray(customer.transactions)) {
      transactions = customer.transactions;
    } else if (typeof customer.transactions === "string") {
      try {
        const parsedTransactions: unknown = JSON.parse(customer.transactions);
        if (Array.isArray(parsedTransactions)) {
          transactions = parsedTransactions;
        }
      } catch {
        transactions = [];
      }
    }

    const newBalance = balance - charge;
    const dataTransaction = {
      type: "data",
      bundle_id: bundleId,
      bundle: bundleLabel,
      data_plan: dataPlan,
      amount: charge,
      phone,
      network,
      date: new Date().toISOString(),
      reference: requestId,
    };

    const { error: updateError } = await adminClient
      .from("customers")
      .update({
        balance: newBalance,
        transactions: [...transactions, dataTransaction],
      })
      .eq("auth_id", userData.user.id);

    if (updateError) {
      console.error("Balance update error:", updateError);
      return jsonResponse({
        success: false,
        message: "Data was sent, but balance update needs support",
      }, 500);
    }

    return jsonResponse({
      success: true,
      newBalance,
      reference: requestId,
      bundleId,
      bundle: bundleLabel,
      dataPlan,
      chargedAmount: charge,
      message: `${bundleLabel} data sent successfully to ${phone}`,
    });
  } catch (error) {
    console.error("Data function error:", error);
    return jsonResponse({
      success: false,
      message: "Data service error",
    }, 500);
  }
});
