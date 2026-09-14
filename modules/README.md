# Reusable Terraform modules

Local reusable modules belong here when they are specific to Declarative Migrations.

Cross-product OCI registry modules are intentionally sourced from `zed-pkg/zed-infra` instead of copied here. Every git module source must use an exact 40-character commit `ref`; floating branches and tags are not acceptable for production infrastructure.

Provider-native working directories and existing composition roots remain in place. Environment roots under `environments/` must not duplicate a resource graph already owned elsewhere.
