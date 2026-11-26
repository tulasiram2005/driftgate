# Security

Report suspected vulnerabilities privately using [GitHub security advisories for DriftGate](https://github.com/tulasiram2005/driftgate/security/advisories/new). Include the affected revision, component, observed behavior and impact. Use synthetic data and redact credentials, signed evidence URLs and personal information.

Keep deployment credentials in the provider's secret settings or ignored local configuration. Anyone who discovers a published credential should revoke or rotate it at the issuing service first. Removing a value from a later commit leaves earlier copies accessible.

Changes to the default branch go through a pull request with Quality Gates and CodeQL analysis. Review the findings as well as the check status. The hosted API can deploy from the default branch, so review the deployment impact before merging.
