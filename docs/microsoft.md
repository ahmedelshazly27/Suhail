# Microsoft 365 setup

Everything Microsoft in the dashboard sits behind typed interfaces (`lib/m365`) and switches on when `AZURE_TENANT_ID`, `AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET` are set in Vercel. Until then the dashboard uses sample adapters and says so on screen.

## 1. App registration (single tenant)

1. entra.microsoft.com, then Applications, App registrations, New registration.
2. Name: `Suhail`. Supported account types: **Accounts in this organizational directory only**. This is what keeps accounts outside the tenant out.
3. Redirect URIs, platform **Web**:
   - Production: `https://sakcroiygqvshzaypxep.supabase.co/auth/v1/callback`
   - Staging and previews: `https://pmzjqczxidunkkdgdsfj.supabase.co/auth/v1/callback`
4. Certificates & secrets, then New client secret (24 months). Copy the value into `AZURE_CLIENT_SECRET`.
5. Overview: copy the Directory (tenant) ID into `AZURE_TENANT_ID` and the Application (client) ID into `AZURE_CLIENT_ID`.
6. Token configuration, then Add groups claim, then **Security groups**.
7. In both Supabase projects: Authentication, Providers, **Azure**. Turn it on and paste the client ID and secret. Azure tenant URL: `https://login.microsoftonline.com/<tenant id>`. This locks sign-in to the tenant.

## 2. Groups decide access

Create three security groups and add people to them:

| Group | Role in the dashboard |
|---|---|
| `suhail-owners` | owner: everything |
| `suhail-admins` | admin: everything except changing owners |
| `suhail-team` | member: all dashboard work, no settings |

The dashboard reads group membership (`/me/memberOf`) on every sign-in and sets the role. Someone in none of the groups is refused and their profile is switched off. RLS enforces the role in the database, not only in the interface.

- **Add a teammate:** add them to `suhail-team` in Microsoft 365. They click "Sign in with Microsoft" once and see the "You're in" screen. Because admin consent is granted, there's no permissions prompt.
- **Remove a teammate:** remove them from the group, or disable their account. Their next sign-in is refused, and an owner can switch them off right away in Settings, Members.

## 3. Permissions and why each one is needed

Grant all of these, then press **Grant admin consent for Suhail** once, so teammates never see a consent screen.

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
| `Calendars.ReadBasic` | Delegated | Free/busy and out-of-office for sprint capacity (v2) |
| `Tasks.ReadWrite` | Delegated | "Suhail" list in Microsoft To Do (v2, optional) |
| `Presence.Read.All` | Delegated | Teams presence on avatars (v2) |
| `Mail.Read` | Application | Email to ticket on `tasks@` (a change subscription has no signed-in user). Restrict it to `tasks@` with an Exchange application access policy. |
| `Mail.Send` | Application | Reply to the sender of a `tasks@` email with the ticket link. Restricted by the same policy. |

Graph tokens are encrypted (AES-256-GCM, `TOKEN_ENCRYPTION_KEY`) in `graph_tokens`, which only server code can read, and refreshed silently.

## 4. Shared drive

1. Create a Microsoft 365 group site (team site) called **Suhail**.
2. In its Documents library create `Brand`, `Templates`, `Partnerships`, `Events`, `Finance`, `Team`, `Projects`.
3. Finance: stop inheriting permissions and give access to `suhail-owners` and the Finance Lead only. Brand: edit rights for Layla and Ahmed, read for `suhail-team`.
4. Find the library's drive id (Graph Explorer: `GET /sites/{hostname}:/sites/Suhail:/drives`) and set `SHAREPOINT_DRIVE_ID`.

## 5. Teams

- **Channel cards:** in the team channel, Workflows, "Post to a channel when a webhook request is received". Copy the URL into `TEAMS_WEBHOOK_URL`.
- **Bot (personal cards, actions, stand-up):** portal.azure.com, Azure Bot, free F0 tier, single tenant, using the same app registration. Messaging endpoint: `https://suhail-lemon.vercel.app/api/teams/messages`. Add the Microsoft Teams channel. Set `MICROSOFT_BOT_ID` (the app id) and `MICROSOFT_BOT_PASSWORD` (a client secret). Publish the app to the org in the Teams admin center so it installs for everyone.
- **Teams tab and SSO (v2):** add a static tab pointing at `/team` in the same Teams app manifest.

## 6. Email to ticket

Create the shared mailbox `tasks@suhail.build` (free on Business Basic) and set `TASKS_MAILBOX`. The daily job creates and renews the Graph change subscription. Forward any email there to make a ticket assigned to you; put `#project-slug` in the subject to file it in that project.
