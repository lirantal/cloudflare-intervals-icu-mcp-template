# Security

This is a single-owner, read-only gateway, not a general multi-tenant hosted service. Read the trust boundaries and remaining limits in docs/ARCHITECTURE.md before deploying a fork.

Do not open a public issue containing API keys, client secrets, bearer tokens, cookies, OAuth codes/state URLs, request dumps, health data, or local configuration files. For a suspected vulnerability, use this repository's GitHub private vulnerability reporting feature when available; otherwise contact the maintainer through their public GitHub profile to arrange a private channel before sharing details.

If credentials are exposed, rotate/revoke them at the issuer first. Removing a value from the latest source tree does not remove it from Git history, hosting caches, or existing copies. Coordinate remediation before any history rewrite.

Real deployment settings belong in ignored deployment.local.json or an explicitly selected private JSON file. Runtime secrets belong in Cloudflare Secret bindings or an ignored secure local secrets file. The public template intentionally contains placeholders. Build layers must never receive runtime secrets.

The code enforces a numeric GitHub owner, PKCE, exact audience, validated ChatGPT callbacks, browser-bound consent, and read-only tool registration. OAuth provider storage uses eventually consistent KV; it is not a claim of globally atomic token redemption. Containers do not have a separate public endpoint. Keep the owner check and protocol validation intact when making changes.
