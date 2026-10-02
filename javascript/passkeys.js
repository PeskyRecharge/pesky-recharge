(function () {
  let pendingLoginOptions = null;

  function decodeBase64Url(value) {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    return Uint8Array.from(binary, character => character.charCodeAt(0)).buffer;
  }

  function encodeBase64Url(value) {
    const bytes = new Uint8Array(value);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function decodeCreationOptions(options) {
    return {
      ...options,
      challenge: decodeBase64Url(options.challenge),
      user: { ...options.user, id: decodeBase64Url(options.user.id) },
      excludeCredentials: (options.excludeCredentials || []).map(credential => ({
        ...credential,
        id: decodeBase64Url(credential.id),
      })),
    };
  }

  function decodeRequestOptions(options) {
    return {
      ...options,
      challenge: decodeBase64Url(options.challenge),
      allowCredentials: (options.allowCredentials || []).map(credential => ({
        ...credential,
        id: decodeBase64Url(credential.id),
      })),
    };
  }

  function serializeCredential(credential) {
    const response = credential.response;
    const serializedResponse = {
      clientDataJSON: encodeBase64Url(response.clientDataJSON),
    };

    if (response.attestationObject) {
      serializedResponse.attestationObject = encodeBase64Url(response.attestationObject);
      serializedResponse.transports = response.getTransports?.() || [];
    }

    if (response.authenticatorData) {
      serializedResponse.authenticatorData = encodeBase64Url(response.authenticatorData);
      serializedResponse.signature = encodeBase64Url(response.signature);
      serializedResponse.userHandle = response.userHandle
        ? encodeBase64Url(response.userHandle)
        : null;
    }

    return {
      id: credential.id,
      rawId: encodeBase64Url(credential.rawId),
      type: credential.type,
      authenticatorAttachment: credential.authenticatorAttachment,
      response: serializedResponse,
      clientExtensionResults: credential.getClientExtensionResults(),
    };
  }

  async function invoke(supabaseClient, body) {
    const { data, error } = await supabaseClient.functions.invoke("passkeys", { body });
    if (error) {
      const responseMessage = error.context?.json?.message;
      throw new Error(responseMessage || error.message || "Passkey service is unavailable.");
    }
    if (data?.message && !data.success && body.action !== "login-options") {
      throw new Error(data.message);
    }
    return data;
  }

  async function isPlatformAvailable() {
    if (!window.isSecureContext || !navigator.credentials || !window.PublicKeyCredential) return false;
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") return true;
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }

  async function register(supabaseClient) {
    const { options } = await invoke(supabaseClient, { action: "registration-options" });
    const credential = await navigator.credentials.create({ publicKey: decodeCreationOptions(options) });
    if (!credential) throw new Error("The device did not create a passkey.");

    return invoke(supabaseClient, {
      action: "registration-verify",
      challenge: options.challenge,
      credential: serializeCredential(credential),
    });
  }

  async function getStatus(supabaseClient) {
    return invoke(supabaseClient, { action: "status" });
  }

  async function hasPasskey(supabaseClient) {
    const result = await invoke(supabaseClient, { action: "login-options" });
    pendingLoginOptions = {
      client: supabaseClient,
      result,
      createdAt: Date.now(),
    };
    return Boolean(result.hasPasskey);
  }

  async function signIn(supabaseClient, signal) {
    const cachedOptions = pendingLoginOptions?.client === supabaseClient &&
      Date.now() - pendingLoginOptions.createdAt < 4 * 60 * 1000
      ? pendingLoginOptions.result
      : null;
    pendingLoginOptions = null;

    const { hasPasskey, options, message } = cachedOptions ||
      await invoke(supabaseClient, { action: "login-options" });
    if (!hasPasskey) throw new Error(message || "No fingerprint sign-in is set up yet. Use your password or set up a passkey from Profile.");

    const credential = await navigator.credentials.get({ publicKey: decodeRequestOptions(options), signal });
    if (!credential) throw new Error("Fingerprint sign-in was cancelled. Try again or use your password.");

    const result = await invoke(supabaseClient, {
      action: "login-verify",
      challenge: options.challenge,
      credential: serializeCredential(credential),
    });

    const { error } = await supabaseClient.auth.verifyOtp({
      token_hash: result.tokenHash,
      type: result.type || "magiclink",
    });
    if (error) throw error;
  }

  window.PeskyPasskeys = { isPlatformAvailable, register, getStatus, hasPasskey, signIn };
})();
