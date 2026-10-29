# Unresolved risks and research gaps

Status: open • Owner: program manager. No implementation, performance test, security test or legal approval has occurred.

| ID | Risk and impact | Owner | Resolution and gate |
|---|---|---|---|
| R-01 | Codec, dependency, font and distribution rights could restrict release | Legal / media | Review exact build flags, patents, dependencies and workspace license before distribution. |
| R-02 | Local processing toolkit contracts and 42 capabilities are documented but not runtime-tested or pinned | Media lead | Capture immutable revision, execute contract and representative fixture tests in isolated phase-0 environment. |
| R-03 | Core v1 structural schemas and API slice now validate; advanced model extensions and later feature APIs are not yet contracted | API / frontend lead | Extend the validated core deliberately for advanced editing and membership/comment/billing/review APIs; implement semantic validation and live contract tests. |
| R-04 | Feature catalog groups capabilities; not every individual capability has all required fields and task/test linkage | Product / QA | Split into granular entries, add defaults, detailed behavior, edge cases and test IDs, run orphan checks. |
| R-05 | Preview parity, VFR, HDR, font shaping and GPU encoder support remain unmeasured | Media / frontend | Run cross-browser/build/device fixture suite; publish tolerances and supported matrix. |
| R-06 | Provider, pricing, quotas, regional storage, retention and compliance requirements are undecided | Product / privacy / procurement | Choose providers, legal terms and policies; update contracts and notices. |
| R-07 | Collaboration concurrency, destructive effects and complex nested composition need further formal specification | Collaboration / timeline | Prototype conflict and timing semantics, add acceptance cases and security review. |
| R-08 | Production reliability, restore, tenant isolation and processing sandbox are design only | Security / SRE | Implement, threat test, chaos test and measure restore and SLOs before release. |
| R-09 | UX has not been validated with users or assistive technologies | Design / accessibility | Conduct task-based testing and independent accessibility assessment. |

These risks block a claim of implementation readiness for all requested scope. See [open decisions](../00-governance/assumptions-and-open-decisions.md) and [delivery gates](../09-delivery/phase-gates-and-definition-of-done.md).
