# Shared Auth topology

The repository contract already names `github.com/shared-auth` as the auth
authority. DEN-2843 makes its Supabase/Neon and customer/admin database boundaries
executable. Customer services use both auth databases; admin services use both
admin databases with no fallback. Supabase's shared runtime organization is a
schema-isolated transition; `declarative-migrations` remains the target Supabase
and dedicated Neon organization. Admin and sensitive work is strict-paired.
Run `node shared-auth/validate.mjs`.
