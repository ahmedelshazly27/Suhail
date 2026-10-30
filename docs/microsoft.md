# Microsoft 365 setup, step by step

This is the exact setup for Suhail's tenant. `suhail.build` is already verified in Microsoft 365: its DNS on Vercel has the `MS=` record, the Outlook MX record and the Outlook SPF record. Do everything below signed in as **a.elshazly@suhail.build** (Global Administrator). It takes about 45 minutes.

Everything Microsoft in the dashboard sits behind typed interfaces (`lib/m365`) and switches on when `AZURE_TENANT_ID`, `AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET` are set in Vercel. Until then the dashboard uses sample adapters and says so on screen.

**Values you'll collect along the way** (keep them in a password manager, not in chat or email):

| Name | Where it comes from | Step |
|---|---|---|
| `AZURE_TENANT_ID` | App registration, Overview, Directory (tenant) ID | 1 |
| `AZURE_CLIENT_ID` | App registration, Overview, Application (client) ID | 1 |
| `AZURE_CLIENT_SECRET` | App registration, Certificates & secrets (the **Value**, not the Secret ID) | 1 |
| `AZURE_GROUP_OWNERS`, `AZURE_GROUP_ADMINS`, `AZURE_GROUP_TEAM` | Each group's Object ID | 3 |
| `SHAREPOINT_DRIVE_ID` | Graph Explorer | 6 |
| `TEAMS_WEBHOOK_URL` | Teams Workflows | 8 |
| `MICROSOFT_BOT_ID`, `MICROSOFT_BOT_PASSWORD` | The same app's client ID and a second secret | 9 |

## 1. Register the app

1. Open **entra.microsoft.com**. Go to **Identity**, then **Applications**, then **App registrations**, and choose **New registration**.
2. Fill it in:
   - **Name:** `Suhail`
   - **Supported account types:** *Accounts in this organizational directory only (Suhail only, Single tenant)*. This is what keeps accounts outside your tenant out.
   - **Redirect URI:** platform **Web**, `https://sakcroiygqvshzaypxep.supabase.co/auth/v1/callback`
3. Choose **Register**.
4. On the app's **Overview**, copy the **Application (client) ID** (`AZURE_CLIENT_ID`) and the **Directory (tenant) ID** (`AZURE_TENANT_ID`).
5. Go to **Authentication**. Under **Web**, then **Redirect URIs**, add a second URI for staging and previews: `https://pmzjqczxidunkkdgdsfj.supabase.co/auth/v1/callback`. Leave both implicit-grant boxes unticked, then **Save**.
6. Go to **Certificates & secrets**, then **Client secrets**, then **New client secret**. Description `supabase`, expiry **24 months**, then **Add**. Copy the **Value** right away, because it's shown once. That's `AZURE_CLIENT_SECRET`. Put a calendar reminder 23 months out to rotate it.
7. Go to **Token configuration**, choose **Add groups claim**, tick **Security groups**, then **Add**.

## 2. API permissions

On the app, go to **API permissions**, then **Add a permission**, then **Microsoft Graph**.

**Delegated permissions** (search for each and tick it):
`openid`, `email`, `profile`, `offline_access`, `User.Read`, `User.ReadBasic.All`, `GroupMember.Read.All`, `Mail.ReadWrite`, `Mail.Send`, `Mail.Read.Shared`, `Mail.Send.Shared`, `Files.ReadWrite.All`, `Sites.ReadWrite.All`, `Calendars.ReadBasic`, `Tasks.ReadWrite`

**Application permissions:**
`Mail.Read`, `Mail.Send`, `User.Read.All`, `GroupMember.Read.All`

Then press **Grant admin consent for Suhail** and confirm. Every row should show a green tick under Status. This is what lets a new teammate sign in with one click and no consent screen.

Why each one is needed:

| Permission | Type | Why |
|---|---|---|
| `openid`, `email`, `profile`, `offline_access` | Delegated | Sign-in, and a refresh token so nobody has to reconnect |
| `User.Read` | Delegated | Name, job title and photo for the profile |
| `GroupMember.Read.All` | Delegated | Reads which `suhail-*` group you're in, to set your role |
| `User.ReadBasic.All` | Delegated | People picker for assignees, owners and @mentions |
| `Mail.ReadWrite` | Delegated | Your inbox in the dashboard, mark as read |
| `Mail.Send` | Delegated | Replies go through Outlook so they land in Sent |
| `Mail.Read.Shared`, `Mail.Send.Shared` | Delegated | `hello@`, `partners@` and `tasks@` for people with access |
| `Files.ReadWrite.All` | Delegated | Attach, create and upload files in OneDrive and SharePoint |
| `Sites.ReadWrite.All` | Delegated | The shared "Suhail" library, project folders, search inside documents |
| `Calendars.ReadBasic` | Delegated | Free/busy and out-of-office for sprint capacity |
| `Tasks.ReadWrite` | Delegated | "Suhail" list in Microsoft To Do (optional) |
| `Mail.Read` | Application | Email to ticket on `tasks@` (a change subscription has no signed-in user). Limited to `tasks@` in step 5. |
| `Mail.Send` | Application | Reply to the sender of a `tasks@` email with the ticket link. Limited the same way. |
| `User.Read.All` | Application | Daily access check: is the account still enabled |
| `GroupMember.Read.All` | Application | Daily access check: is the person still in a `suhail-*` group |

Graph tokens are encrypted (AES-256-GCM, `TOKEN_ENCRYPTION_KEY`) in `graph_tokens`, which only server code can read, and are refreshed silently.

## 3. Groups decide who gets in

In entra.microsoft.com, go to **Groups**, then **All groups**, then **New group**. Create three, each with **Group type: Security** and **Membership type: Assigned**:

| Group name | Role in the dashboard | Add now |
|---|---|---|
| `suhail-owners` | owner: everything | a.elshazly@suhail.build |
| `suhail-admins` | admin: everything except changing owners | anyone who runs settings |
| `suhail-team` | member: all dashboard work, no settings | everyone else |

Open each group and copy its **Object ID** from Overview into `AZURE_GROUP_OWNERS`, `AZURE_GROUP_ADMINS` and `AZURE_GROUP_TEAM`. Roles come from these IDs, never from group names, because anyone in the tenant can create a group with the same name.

How access works after that:
- **Add a teammate:** create their Microsoft 365 user (it needs a licence for mail), then add them to `suhail-team`. They open `https://team.suhail.build`, choose **Sign in with Microsoft** once, see the "You're in" screen and then the guided tour. There's no consent prompt.
- **Remove a teammate:** remove them from the group or block their sign-in. The daily check (05:30 UTC) switches them off, and an owner can do it at once in Settings, then Members.
- Someone in none of the groups is refused, and RLS enforces the role in the database, not only in the interface.

## 4. Mailboxes

Open **admin.microsoft.com**, then **Teams & groups**, then **Shared mailboxes**, then **Add a shared mailbox**. Create each of these and add yourself (and whoever handles them) as members:

| Mailbox | Why |
|---|---|
| `hello@suhail.build` | Site emails are sent **from** this address through Resend, so replies land here |
| `partners@suhail.build` | Partner enquiries |
| `careers@suhail.build` | Applicant replies |
| `tasks@suhail.build` | Email to ticket |

Shared mailboxes are free and need no licence.

## 5. Limit the app's mail access to `tasks@` only

The application `Mail.Read` and `Mail.Send` permissions would otherwise reach every mailbox. On any PC, open PowerShell:

```powershell
Install-Module ExchangeOnlineManagement -Scope CurrentUser
Connect-ExchangeOnline -UserPrincipalName a.elshazly@suhail.build
New-DistributionGroup -Name "suhail-app-mailboxes" -Alias suhail-app-mailboxes -Type Security -Members tasks@suhail.build
New-ApplicationAccessPolicy -AppId <AZURE_CLIENT_ID> -PolicyScopeGroupId suhail-app-mailboxes@suhail.build -AccessRight RestrictAccess -Description "Suhail app: tasks@ only"
Test-ApplicationAccessPolicy -Identity tasks@suhail.build -AppId <AZURE_CLIENT_ID>
Test-ApplicationAccessPolicy -Identity a.elshazly@suhail.build -AppId <AZURE_CLIENT_ID>
```

The first test should say **Granted** and the second **Denied**. It can take up to an hour to apply.

## 6. Shared drive (SharePoint)

1. In admin.microsoft.com, go to **Teams & groups**, then **Active teams & groups**, then **Add a Microsoft 365 group**. Name it `Suhail` with email `suhail@suhail.build`, and add the team. This creates the site `https://suhailbuild.sharepoint.com/sites/Suhail`. Your tenant's SharePoint host may differ: check it under **SharePoint**, then **Active sites**.
2. Open the site's **Documents** and create the folders `Brand`, `Templates`, `Partnerships`, `Events`, `Finance`, `Team` and `Projects`.
3. Lock down `Finance`: open it, choose **Manage access**, then **Stop inheriting permissions**, and keep only `suhail-owners` and the Finance lead.
4. Get the drive ID. Open **developer.microsoft.com/graph/graph-explorer** and sign in as yourself. Run `GET https://graph.microsoft.com/v1.0/sites/<your-host>.sharepoint.com:/sites/Suhail:/drives`, then copy the `id` of the drive named **Documents**. That's `SHAREPOINT_DRIVE_ID`. If Graph Explorer asks for consent to `Sites.Read.All` for itself, accept: that's Graph Explorer, not Suhail.

## 7. Supabase

Do this in **both** projects (production `sakcroiygqvshzaypxep` and staging `pmzjqczxidunkkdgdsfj`) at supabase.com/dashboard.

1. Go to **Authentication**, then **Sign In / Providers**, then **Azure**, and turn it on.
   - **Application (client) ID:** `AZURE_CLIENT_ID`
   - **Secret value:** `AZURE_CLIENT_SECRET`
   - **Azure Tenant URL:** `https://login.microsoftonline.com/<AZURE_TENANT_ID>`. This locks sign-in to your tenant.
   - Save.
2. Go to **Authentication**, then **URL Configuration**.
   - **Production project.** Site URL `https://team.suhail.build`. Redirect URLs: `https://team.suhail.build/**` and `https://suhail.build/**`.
   - **Staging project.** Site URL `https://team.suhail.build`. Redirect URL: `https://suhail-*-ahmedelshazly2345-gmailcoms-projects.vercel.app/**`, which covers every preview deployment and branch URL.

## 8. Teams channel cards

In Teams, open the team's channel and choose **⋯** then **Workflows**. Pick **Post to a channel when a webhook request is received**, name it `Suhail` and choose **Add workflow**. Copy the URL it shows: that's `TEAMS_WEBHOOK_URL`.

## 9. Teams bot (personal cards, "mark done", stand-up)

1. In the app registration from step 1, go to **Certificates & secrets** and create a **second** client secret (description `bot`). That's `MICROSOFT_BOT_PASSWORD`. `MICROSOFT_BOT_ID` is the same Application (client) ID.
2. Go to **portal.azure.com** and choose **Create a resource**, then **Azure Bot**. This needs an Azure subscription; the bot itself is free.
   - Bot handle `suhail-bot`, pricing tier **Free (F0)**.
   - **Type of App:** Single Tenant. **Creation type:** *Use existing app registration*. Paste the client ID and tenant ID.
   - After it's created, open **Configuration** and set **Messaging endpoint** to `https://suhail.build/api/teams/messages`, then **Apply**.
   - Open **Channels**, add **Microsoft Teams**, accept the terms and **Apply**.
3. Go to **dev.teams.microsoft.com**, then **Apps**, then **New app**, and name it `Suhail`.
   - **Basic information:** short and long description, developer name `Suhail`, website `https://suhail.build`, privacy `https://suhail.build`, terms `https://suhail.build`, and the **Application (client) ID** from step 1.
   - **Branding:** use `public/icons/icon-192.png` for the colour icon. The outline icon must be 32×32 and transparent: export the star from `components/site/Star.tsx`.
   - **App features**, then **Bot**: choose *Enter a bot ID*, paste `MICROSOFT_BOT_ID`, and tick the **Personal** and **Team** scopes.
   - **App features**, then **Personal app**: add a tab named `Suhail` with URL `https://team.suhail.build`.
   - Under **Domains**, add `suhail.build` and `team.suhail.build`.
   - Choose **Publish**, then **Publish to your org**.
4. Open **admin.teams.microsoft.com**, then **Teams apps**, then **Manage apps**, and approve `Suhail`. Then go to **Setup policies**, then **Global**, choose **Installed apps**, then **Add apps**, and add `Suhail` so it installs for everyone.

## 10. Vercel

In Vercel, open the `suhail` project, then **Settings**, then **Environment Variables**. Add these to **Production** and **Preview** unless noted. Mark the secrets as **Sensitive**.

| Key | Value |
|---|---|
| `AZURE_TENANT_ID` | from step 1 |
| `AZURE_CLIENT_ID` | from step 1 |
| `AZURE_CLIENT_SECRET` | from step 1 (Sensitive) |
| `AZURE_GROUP_OWNERS`, `AZURE_GROUP_ADMINS`, `AZURE_GROUP_TEAM` | from step 3 |
| `SHAREPOINT_DRIVE_ID` | from step 6 |
| `SHARED_MAILBOXES` | `hello@suhail.build,partners@suhail.build,careers@suhail.build` |
| `TASKS_MAILBOX` | `tasks@suhail.build` |
| `TEAMS_WEBHOOK_URL` | from step 8 (Sensitive) |
| `MICROSOFT_BOT_ID` | same as `AZURE_CLIENT_ID` |
| `MICROSOFT_BOT_PASSWORD` | from step 9 (Sensitive) |
| `NEXT_PUBLIC_SITE_URL` | Production only: `https://suhail.build` |
| `TEAM_HOST` | Production only: `team.suhail.build` |
| `OWNER_EMAIL` | `a.elshazly@suhail.build` |
| `MAIL_SAFE_TO` | `a.elshazly@suhail.build` |
| `MAIL_ALLOWLIST` | `a.elshazly@suhail.build` until launch, then `*` |

Then go to **Deployments**, open the latest Production deployment, choose **⋯** and **Redeploy**. Environment variables only take effect on a new deployment.

The domains `suhail.build`, `www.suhail.build` (redirects to `suhail.build`) and `team.suhail.build` are already attached to the project, on Vercel DNS.

## 11. Check it works

1. In a private window, open `https://team.suhail.build` and choose **Sign in with Microsoft**. Sign in as a.elshazly@suhail.build. You should get no consent screen, then "You're in", then the tour. Settings, then Members, should show you as **owner**.
2. Sign in with a personal Outlook.com account: it's refused by Microsoft before it reaches Suhail.
3. Add a test user to `suhail-team` and sign in as them: you should see **member**. Remove them, wait for the next daily check (or switch them off in Settings, then Members), and they're out.
4. Assign yourself a ticket: a Teams card arrives in the Suhail app chat, and **Mark done** works from Teams.
5. Forward any email to `tasks@suhail.build`. Within a minute a ticket appears in My work, and the sender gets a reply with its link.
6. Subscribe your Outlook calendar to the feed in Settings, then Me: due dates appear in Outlook.
7. Drive shows the Suhail library and its folders, and Finance is missing for anyone outside `suhail-owners` and Finance.
