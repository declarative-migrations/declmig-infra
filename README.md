# declmig-infra

Cloudflare Workers and Kubernetes manifests for `declarative-migrations`.
Cluster source of truth remains github.com/oresoftware/k8s-cluster.

The [mobile-web and application-link runbook](docs/mobile-web-and-app-links.md)
prepares a fail-closed Flutter edge without inventing an owned domain or
release signing identity. Activation remains blocked by issue #1; the Worker
rejects the current `.invalid` callback placeholder and exposes no admin route.
