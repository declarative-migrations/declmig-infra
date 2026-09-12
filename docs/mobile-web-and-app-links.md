# Flutter mobile-web and application-link activation

The edge implementation is ready but deliberately inactive. Declarative
Migrations has no owned domain recorded in its organization/Linear mapping;
the Flutter profiles use the non-routable
`m.declarative-migrations.invalid`, and the marketing site publishes only at
`declarative-migrations.github.io`. Issue
[#1](https://github.com/declarative-migrations/declmig-infra/issues/1) owns the
domain decision and external activation gates.

## Prepared behavior

Once `DECLMIG_MOBILE_WEB_HOST=m.<owned-domain>` is supplied and the exact
Worker route is attached, the edge:

- proxies the Flutter application to a distinct validated HTTPS origin;
- serves `/.well-known/assetlinks.json` only for Android package
  `com.declarativemigrations.declmig_flutter` and a real release certificate
  SHA-256 fingerprint;
- reserves AASA for signed Apple app ID
  `<TEAM_ID>.com.declarativemigrations.declmigFlutter` but returns 503 until an
  iOS runner and team identity actually exist;
- forces `no-store` for `/auth/callback`, the Flutter shell/bootstrap/main
  bundle/service worker, `/u/status`, and unknown paths;
- gives only `/assets/*` and `/icons/*` a short public cache, allows the Flutter
  service worker to control `/`, and rewrites provider redirects to the public
  host;
- permits Supabase and `ores-shared-auth.com` in the mobile CSP without adding
  any admin host or route.

The Worker rejects blank, `.invalid`, `.example`, `.test`, and localhost host
configuration. Association endpoints also fail closed when signing values are
blank, malformed, or name another app. Dummy public association identities are
not an activation shortcut.

## Activation checklist

1. Record an owned apex domain in the organization’s Linear project, GitHub
   project, and Cloudflare zone mapping.
2. Deploy the reviewed `declmig-flutter/build/web` output to a distinct HTTPS
   provider origin. Do not upload `env/dec`.
3. Apply `cloudflare/mobile-web-plan.json` with the concrete zone and provider
   host: proxied CNAME, automatic TTL, Universal SSL, Always Use HTTPS, minimum
   TLS 1.2, and Full (strict) origin TLS.
4. Set `DECLMIG_MOBILE_WEB_HOST`, `DECLMIG_MOBILE_WEB_ORIGIN`, and the real
   release signing values. Add the exact `m.<owned-domain>/*` route.
5. Update the encrypted Flutter callback/admin profiles through ores-sops and
   build with `AUTH_CALLBACK_URL=https://m.<owned-domain>/auth/callback` and
   `ADMIN_LOGIN_ENABLED=no`.
6. Add that exact callback to Supabase Auth. Do not use a wildcard, provider
   origin, GitHub Pages host, or admin host. Verify confirmation/recovery mail.
7. Add the Android App Link manifest only after the host is final. Add Apple or
   desktop declarations only after those runners and signing identities exist.

## Verification

Repository checks:

```sh
npm --prefix cloudflare test
npm --prefix cloudflare run check
```

After activation, verify the shell, callback, service worker, and association
documents with `curl` without silently following redirects. On a release-signed
Android device, run `pm verify-app-links --re-verify`, inspect `pm
get-app-links`, and open `/u/status` from cold, warm, and logged-out states.
Also test invalid/expired callbacks, unsupported routes, and the browser
fallback. Redact codes, tokens, emails, and sessions from retained evidence.

The current USB device is disconnected, and the Flutter repository has no iOS
or desktop runners. These are release blockers, not evidence of acceptance.

## Rollback

Blank the affected signing value first so associations fail closed, then remove
the Worker route and proxied DNS record and roll back the Worker. Remove the
exact Supabase callback allowlist entry if the host is retired. Never redirect
authentication callbacks to an admin service or expose the provider origin as
a temporary public callback.
