# Infrastructure layout decision

Declarative Migrations follows the fleet modules-first contract with root `modules/` and `environments/` boundaries.

The OCI Terraform root under `infra/oci/terraform/` intentionally composes cross-product registry modules from `zed-pkg/zed-infra` instead of copying them locally. Those git module sources must be immutable: each source is pinned to an exact 40-character commit ref.

Use root `modules/` only for reusable infrastructure that is specific to this product. Keep provider-native or specialized composition roots in place when their working directory is part of an external integration or a reviewed deployment contract.
