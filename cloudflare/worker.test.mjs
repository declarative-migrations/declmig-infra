import assert from "node:assert/strict";
import test from "node:test";

import {
  androidAssociationDocument,
  appleAssociationDocument,
  associationResponse,
  cacheControlForPath,
  reviewedMobileHost,
  routeRequest,
} from "./worker.js";

const fingerprint = Array.from(
  { length: 32 },
  (_, index) => index.toString(16).padStart(2, "0"),
)
  .join(":")
  .toUpperCase();

const env = {
  DECLMIG_MOBILE_WEB_HOST: "m.declmig.dev",
  DECLMIG_MOBILE_WEB_ORIGIN: "https://mobile-origin.internal",
  DECLMIG_STATIC_TTL_SECONDS: "300",
  DECLMIG_ANDROID_PACKAGE_ID: "com.declarativemigrations.declmig_flutter",
  DECLMIG_ANDROID_SHA256_CERT_FINGERPRINT: fingerprint,
  DECLMIG_APPLE_APP_ID:
    "ABCDEFGHIJ.com.declarativemigrations.declmigFlutter",
};

test("health is no-store and does not reach an origin", async () => {
  const response = await routeRequest(
    new Request("https://edge.example/health"),
    env,
    async () => {
      throw new Error("must not fetch");
    },
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("unconfigured and placeholder domains never activate mobile routing", () => {
  for (const host of [
    "",
    "localhost",
    "m.declarative-migrations.invalid",
    "m.product.example",
    "m.product.test",
  ]) {
    assert.equal(reviewedMobileHost(host), null, host);
  }
  assert.equal(reviewedMobileHost("M.DECLMIG.DEV."), "m.declmig.dev");
});

test("non-mobile hosts preserve the existing pass-through behavior", async () => {
  const response = await routeRequest(
    new Request("https://api.declmig.dev/v1/status"),
    env,
    async () => new Response("passthrough", { status: 202 }),
  );
  assert.equal(response.status, 202);
  assert.equal(await response.text(), "passthrough");
});

test("mobile requests use a distinct origin and canonicalize redirects", async () => {
  let seen;
  const response = await routeRequest(
    new Request("https://m.declmig.dev/u/status?from=mail"),
    env,
    async (request) => {
      seen = request;
      return new Response(null, {
        status: 302,
        headers: { location: "https://mobile-origin.internal/login" },
      });
    },
  );
  assert.equal(
    seen.url,
    "https://mobile-origin.internal/u/status?from=mail",
  );
  assert.equal(response.headers.get("location"), "https://m.declmig.dev/login");
});

test("invalid or public origins fail closed", async () => {
  for (const origin of [
    "",
    "http://mobile-origin.internal",
    "https://user:password@mobile-origin.internal",
    "https://mobile-origin.internal/path",
    "https://m.declmig.dev",
  ]) {
    const response = await routeRequest(
      new Request("https://m.declmig.dev/"),
      { ...env, DECLMIG_MOBILE_WEB_ORIGIN: origin },
      async () => {
        throw new Error("must not fetch");
      },
    );
    assert.equal(response.status, 503, origin);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});

test("auth, shell, worker, and product routes are never cached", () => {
  for (const pathname of [
    "/",
    "/auth/callback",
    "/flutter_bootstrap.js",
    "/flutter_service_worker.js",
    "/main.dart.js",
    "/u/status",
  ]) {
    assert.equal(cacheControlForPath(pathname, env), "no-store", pathname);
  }
  assert.equal(
    cacheControlForPath("/assets/AssetManifest.bin", env),
    "public, max-age=300",
  );
});

test("mobile responses carry service-worker scope and reviewed CSP", async () => {
  const response = await routeRequest(
    new Request("https://m.declmig.dev/flutter_service_worker.js"),
    env,
    async () => new Response("worker"),
  );
  assert.equal(response.headers.get("service-worker-allowed"), "/");
  assert.match(response.headers.get("content-security-policy"), /supabase/);
  assert.doesNotMatch(response.headers.get("content-security-policy"), /admin/);
});

test("association documents bind exact Android and Apple identities", () => {
  assert.deepEqual(androidAssociationDocument(env), [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.declarativemigrations.declmig_flutter",
        sha256_cert_fingerprints: [fingerprint],
      },
    },
  ]);
  assert.equal(
    appleAssociationDocument(env).applinks.details[0].appID,
    "ABCDEFGHIJ.com.declarativemigrations.declmigFlutter",
  );
});

test("association documents reject missing and mismatched identities", () => {
  assert.equal(
    androidAssociationDocument({
      ...env,
      DECLMIG_ANDROID_SHA256_CERT_FINGERPRINT: "",
    }),
    null,
  );
  assert.equal(
    androidAssociationDocument({
      ...env,
      DECLMIG_ANDROID_PACKAGE_ID: "attacker.app",
    }),
    null,
  );
  assert.equal(
    appleAssociationDocument({ ...env, DECLMIG_APPLE_APP_ID: "" }),
    null,
  );
});

test("association endpoints are host-scoped and fail closed", () => {
  const unavailable = associationResponse(
    new URL("https://m.declmig.dev/.well-known/assetlinks.json"),
    { ...env, DECLMIG_ANDROID_SHA256_CERT_FINGERPRINT: "" },
  );
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get("cache-control"), "no-store");

  const ready = associationResponse(
    new URL("https://m.declmig.dev/.well-known/apple-app-site-association"),
    env,
  );
  assert.equal(ready.status, 200);
  assert.equal(ready.headers.get("content-type"), "application/json");
  assert.equal(
    associationResponse(
      new URL("https://api.declmig.dev/.well-known/assetlinks.json"),
      env,
    ),
    null,
  );
});
