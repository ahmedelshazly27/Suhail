# Blockers: things only you can do

Everything below is built and running behind a flag or a mock. Each item switches on as soon as you finish the steps.

## 1. Register the Microsoft (Entra ID) app

**Redirect URI (production):** `https://sakcroiygqvshzaypxep.supabase.co/auth/v1/callback`
**Redirect URI (staging/previews):** `https://pmzjqczxidunkkdgdsfj.supabase.co/auth/v1/callback`

Full walkthrough with every permission and its reason: `docs/microsoft.md`. Short version:
1. entra.microsoft.com > App registrations > New registration. Name `Suhail`, "Accounts in this organizational directory only".
2. Add both redirect URIs above as **Web** platform URIs.
3. Certificates & secrets > New client secret (24 months). Copy the value.
4. API permissions: add the delegated and application permissions listed in `docs/microsoft.md`, then **Grant admin consent**.
5. Token configuration > Add groups claim > Security groups.
6. Create security groups `suhail-owners`, `suhail-admins`, `suhail-team`; add yourself to `suhail-owners`.
7. Add these to this environment's secrets (and tell me): `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`.

Until then: sign in at `/team/sign-in` with the owner-only email link (flag `DEV_LOGIN`, off in Production).
