# Shared Auth dual-provider topology

DEN-2843 adds Declarative Migrations' strict, secret-free Supabase Auth + Neon Auth boundary. Customer web/API servers use only `SUPABASE_AUTH_DATABASE_URL` + `NEON_AUTH_DATABASE_URL`; admin web/API servers use only `SUPABASE_ADMIN_DATABASE_URL` + `NEON_ADMIN_DATABASE_URL`.

Supabase and Neon runtime/target organizations must each exactly equal `declarative-migrations`. Shared `oresoftware` placement, schema-only tenancy in another provider organization, transition waivers, generic database fallback, and cross-plane fallback are hard failures. Both providers are required; admin and sensitive migration operations use strict-paired proof and provider disagreement denies.

Customer web/API currently lack an approved Shared Auth path. Both admin services depend on ores-middleware but remain blocked until explicit Supabase and Neon Shared Auth verifier lanes replace `AnonymousAuth`. The four provider/realm migrations are additive, RLS-enabled, default-deny runtime-identity markers. Application startup never plans or applies DDL.

The topology pins strict fleet authority `shared-auth/shared-auth-infra@ce6de94e585637b9f3c370b6e917d74e6bb08a7e`, including independent TypeSpec/JSON Schema/TJSV evidence and separately required runtime authorization tests.

```sh
node shared-auth/validate.mjs
```
