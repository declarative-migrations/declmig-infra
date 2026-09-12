export const ANDROID_PACKAGE = "com.declarativemigrations.declmig_flutter";
export const APPLE_BUNDLE_ID = "com.declarativemigrations.declmigFlutter";

const securityHeaders = Object.freeze({
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
});
const releaseFingerprintPattern = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const appleAppIdPattern = /^[A-Z0-9]{10}\.[A-Za-z0-9.-]+$/;
const noStorePaths = new Set([
  "/",
  "/auth/callback",
  "/flutter_bootstrap.js",
  "/flutter_service_worker.js",
  "/index.html",
  "/main.dart.js",
  "/manifest.json",
  "/version.json",
]);

export default {
  async fetch(request, env) {
    return routeRequest(request, env, fetch);
  },
};

export async function routeRequest(request, env, fetchImpl) {
  const source = new URL(request.url);
  if (source.pathname === "/health") {
    return secure(Response.json({ ok: true, service: "declmig-edge" }), {
      cacheControl: "no-store",
    });
  }

  const mobileHost = reviewedMobileHost(env.DECLMIG_MOBILE_WEB_HOST);
  if (mobileHost === null || normalizeHost(source.hostname) !== mobileHost) {
    return fetchImpl(request);
  }

  const association = associationResponse(source, env);
  if (association !== null) return association;

  const origin = reviewedOrigin(env.DECLMIG_MOBILE_WEB_ORIGIN, mobileHost);
  if (origin === null) {
    return secure(new Response("mobile web origin is not configured", { status: 503 }), {
      cacheControl: "no-store",
      mobile: true,
    });
  }

  const target = new URL(source.pathname + source.search, origin);
  const headers = new Headers(request.headers);
  headers.set("x-forwarded-host", source.host);
  headers.set("x-forwarded-proto", "https");
  headers.delete("cf-connecting-ip");
  const response = await fetchImpl(
    new Request(target, {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? null
          : request.body,
      redirect: "manual",
    }),
  );
  return secure(response, {
    cacheControl: cacheControlForPath(source.pathname, env),
    mobile: true,
    origin,
    source,
  });
}

export function androidAssociationDocument(env) {
  const fingerprint = String(
    env.DECLMIG_ANDROID_SHA256_CERT_FINGERPRINT ?? "",
  )
    .trim()
    .toUpperCase();
  if (
    env.DECLMIG_ANDROID_PACKAGE_ID !== ANDROID_PACKAGE ||
    !releaseFingerprintPattern.test(fingerprint)
  ) {
    return null;
  }
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: ANDROID_PACKAGE,
        sha256_cert_fingerprints: [fingerprint],
      },
    },
  ];
}

export function appleAssociationDocument(env) {
  const appId = String(env.DECLMIG_APPLE_APP_ID ?? "").trim();
  if (
    !appleAppIdPattern.test(appId) ||
    !appId.endsWith(`.${APPLE_BUNDLE_ID}`)
  ) {
    return null;
  }
  return {
    applinks: {
      apps: [],
      details: [
        {
          appID: appId,
          components: [
            { "/": "/auth/callback", comment: "Supabase and Shared Auth return" },
            { "/": "/u/status", comment: "Migration connection status" },
          ],
        },
      ],
    },
  };
}

export function associationResponse(source, env) {
  const configuredHost = reviewedMobileHost(env.DECLMIG_MOBILE_WEB_HOST);
  if (configuredHost === null || normalizeHost(source.hostname) !== configuredHost) {
    return null;
  }
  let document;
  if (source.pathname === "/.well-known/assetlinks.json") {
    document = androidAssociationDocument(env);
  } else if (
    source.pathname === "/.well-known/apple-app-site-association" ||
    source.pathname === "/apple-app-site-association"
  ) {
    document = appleAssociationDocument(env);
  } else {
    return null;
  }
  if (document === null) {
    return secure(
      new Response("release signing identity is not configured", { status: 503 }),
      { cacheControl: "no-store" },
    );
  }
  return secure(
    new Response(JSON.stringify(document), {
      headers: { "content-type": "application/json" },
    }),
    { cacheControl: "public, max-age=300" },
  );
}

export function cacheControlForPath(pathname, env) {
  if (noStorePaths.has(pathname)) return "no-store";
  if (pathname.startsWith("/assets/") || pathname.startsWith("/icons/")) {
    return `public, max-age=${positiveInteger(env.DECLMIG_STATIC_TTL_SECONDS, 300)}`;
  }
  return "no-store";
}

export function reviewedMobileHost(value) {
  const host = normalizeHost(value);
  if (
    !host.includes(".") ||
    host.endsWith(".invalid") ||
    host.endsWith(".example") ||
    host.endsWith(".test") ||
    host === "localhost"
  ) {
    return null;
  }
  return host;
}

function reviewedOrigin(value, publicHost) {
  try {
    const origin = new URL(value);
    if (
      origin.protocol !== "https:" ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash ||
      normalizeHost(origin.hostname) === publicHost
    ) {
      return null;
    }
    return origin;
  } catch {
    return null;
  }
}

function secure(response, options) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders)) {
    headers.set(name, value);
  }
  headers.set("cache-control", options.cacheControl);
  headers.set(
    "content-security-policy",
    options.mobile
      ? "default-src 'self'; base-uri 'none'; connect-src 'self' https://*.supabase.co https://ores-shared-auth.com; font-src 'self' data:; frame-ancestors 'none'; img-src 'self' data: blob:; object-src 'none'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:"
      : "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  );
  if (options.source?.pathname === "/flutter_service_worker.js") {
    headers.set("service-worker-allowed", "/");
  }
  const location = headers.get("location");
  if (location !== null && options.origin && options.source) {
    const redirect = new URL(location, options.origin);
    if (normalizeHost(redirect.hostname) === normalizeHost(options.origin.hostname)) {
      redirect.protocol = "https:";
      redirect.host = options.source.host;
      headers.set("location", redirect.toString());
    }
  }
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function normalizeHost(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\.$/, "");
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
