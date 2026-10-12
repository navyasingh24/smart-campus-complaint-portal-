# Credentials are never written here. The provider reads them from:
#   RENDER_API_KEY   - Render API key (Account Settings > API Keys)
#   RENDER_OWNER_ID  - your workspace ID (usr-... or tea-...)
# In Jenkins they come from the "render-api-key" and "render-owner-id"
# credentials; on a laptop, export them in the shell before running Terraform.
provider "render" {}
