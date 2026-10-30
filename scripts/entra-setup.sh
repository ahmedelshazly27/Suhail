#!/usr/bin/env bash
# One-shot Microsoft Entra setup for Suhail (docs/microsoft.md, steps 1 to 3), run as a Global Administrator.
# Safe to re-run: it reuses the "Suhail" app and the suhail-* groups if they already exist.
#
# Easiest: open https://shell.azure.com (Bash), paste this whole file, press Enter.
# Or locally with the Azure CLI: az login --allow-no-subscriptions && bash scripts/entra-setup.sh
#
# It prints the values for Vercel at the end. It never prints or creates a client secret: keep the one you made.
set -euo pipefail

GRAPH=00000003-0000-0000-c000-000000000000
REDIRECTS=(https://sakcroiygqvshzaypxep.supabase.co/auth/v1/callback https://pmzjqczxidunkkdgdsfj.supabase.co/auth/v1/callback)
DELEGATED=(openid email profile offline_access User.Read User.ReadBasic.All GroupMember.Read.All Mail.ReadWrite Mail.Send
  Mail.Read.Shared Mail.Send.Shared Files.ReadWrite.All Sites.ReadWrite.All Calendars.ReadBasic Tasks.ReadWrite)
APPLICATION=(Mail.Read Mail.Send User.Read.All GroupMember.Read.All)

echo "1/5 App registration"
APP=$(az ad app list --display-name Suhail --query "[0].appId" -o tsv)
if [ -z "$APP" ]; then
  APP=$(az ad app create --display-name Suhail --sign-in-audience AzureADMyOrg --query appId -o tsv)
  echo "   created Suhail ($APP)"
else
  echo "   found Suhail ($APP)"
fi
az ad app update --id "$APP" --sign-in-audience AzureADMyOrg --web-redirect-uris "${REDIRECTS[@]}" --set groupMembershipClaims=SecurityGroup

echo "2/5 Graph permissions"
PERMS=()
for p in "${DELEGATED[@]}"; do
  id=$(az ad sp show --id $GRAPH --query "oauth2PermissionScopes[?value=='$p'].id | [0]" -o tsv)
  PERMS+=("$id=Scope")
done
for p in "${APPLICATION[@]}"; do
  id=$(az ad sp show --id $GRAPH --query "appRoles[?value=='$p'].id | [0]" -o tsv)
  PERMS+=("$id=Role")
done
az ad app permission add --id "$APP" --api $GRAPH --api-permissions "${PERMS[@]}" --only-show-errors

echo "3/5 Admin consent (so teammates never see a consent screen)"
az ad sp show --id "$APP" >/dev/null 2>&1 || az ad sp create --id "$APP" --only-show-errors >/dev/null
sleep 20 # Entra needs a moment before consenting to a new service principal
az ad app permission admin-consent --id "$APP"

echo "4/5 Groups"
ME=$(az ad signed-in-user show --query id -o tsv)
group() {
  local id
  id=$(az ad group show --group "$1" --query id -o tsv 2>/dev/null || true)
  [ -n "$id" ] || id=$(az ad group create --display-name "$1" --mail-nickname "$1" --description "$2" --query id -o tsv)
  echo "$id"
}
OWNERS=$(group suhail-owners "Suhail dashboard: owners")
ADMINS=$(group suhail-admins "Suhail dashboard: admins")
TEAM=$(group suhail-team "Suhail dashboard: team members")
if [ "$(az ad group member check --group "$OWNERS" --member-id "$ME" --query value -o tsv)" != "true" ]; then
  az ad group member add --group "$OWNERS" --member-id "$ME"
fi
echo "   you are in suhail-owners"

echo "5/5 Done. Put these in Vercel (Settings, Environment Variables, Production and Preview):"
echo
echo "AZURE_TENANT_ID=$(az account show --query tenantId -o tsv)"
echo "AZURE_CLIENT_ID=$APP"
echo "AZURE_GROUP_OWNERS=$OWNERS"
echo "AZURE_GROUP_ADMINS=$ADMINS"
echo "AZURE_GROUP_TEAM=$TEAM"
echo
echo "AZURE_CLIENT_SECRET is the secret Value you created. Enter it yourself in Vercel (Sensitive) and in Supabase."
