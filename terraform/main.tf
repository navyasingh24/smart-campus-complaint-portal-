# What Terraform manages on Render (and what it deliberately does not)
#
# MANAGED HERE
#   * render_env_group      "smart-campus-app-settings": non-secret application
#                           settings (JWT_EXPIRES_IN, AUTH_RATE_LIMIT_MAX)
#   * render_env_group_link links that group to the existing web service
#
# NOT MANAGED HERE (on purpose)
#   * The web service itself. It is created and configured by render.yaml
#     (Render Blueprint). render-oss/render v1.9.x cannot reliably update an
#     existing free-plan web service: it sends maintenance_mode, which Render
#     rejects for free instances (provider issue #80 / PR #105). Managing the
#     same service from both the Blueprint and Terraform would also conflict.
#   * Secrets (JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD) stay in render.yaml /
#     the Render dashboard so they are never written to Terraform state.
#   * The deploy hook URL (not exposed by the provider).
#
# Variables set directly on the service take precedence over a linked group,
# so only keys that render.yaml does NOT define are placed in this group.

resource "render_env_group" "app_settings" {
  name = var.env_group_name

  env_vars = {
    JWT_EXPIRES_IN = {
      value = var.jwt_expires_in
    }
    AUTH_RATE_LIMIT_MAX = {
      value = tostring(var.auth_rate_limit_max)
    }
  }
}

resource "render_env_group_link" "app_settings" {
  env_group_id = render_env_group.app_settings.id
  service_ids  = [var.render_service_id]
}
