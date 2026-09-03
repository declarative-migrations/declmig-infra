# Declarative Migrations OCI image and registry contract

Application, worker, and sibling `*-lambda` repositories own executable build contexts. This repository owns optional registry declarations and immutable publisher wiring. Pull-request CI does not apply Terraform, sync Crossplane, publish an image, mutate a database, run a migration, or promote a deployment.

Provider modules are pinned to `zed-pkg/zed-infra@698c675f57fd70ebe24a8a08f963599c4c84fa5a`. The BuildKit/Lambda publisher is pinned to `zed-pkg/zed-infra@e0454f5d0d8c970dfa206595a48eda5ead382544` and verified as Git blob `8490ce53434410192c750b10d17fe122e9df30be` before execution.

- Lambda consumes same-region ECR and exactly one architecture per image reference.
- Cloud Run consumes Google Artifact Registry, preferably colocated with the workload.
- Azure workloads may consume Basic ACR with the administrator account disabled.
- Docker Hub is an optional mirror, not the production digest authority.
- R2 is post-push archive/disaster-recovery storage, never a direct OCI Distribution endpoint.

Production consumers pin `repository@sha256:...`. TypeSpec and JSON Schema Draft 2020-12 remain independent top-level migration/interface authorities; an image may package only generated outputs whose parity gate passed. Diesel and SeaORM artifacts remain backend-private and must agree with canonical SQL. A schema discrepancy stops the release rather than selecting one authority mechanically.

No production database URL, credential, tenant/customer schema or data, live snapshot, ad-hoc production SQL, migration lock/state, decrypted environment, private source snapshot, PAT, cloud key, or Docker password may enter build arguments, layers, labels, provenance, logs, Terraform state, or R2 metadata.
