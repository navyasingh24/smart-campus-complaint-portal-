output "env_group_id" {
  description = "ID of the Terraform-managed environment group."
  value       = render_env_group.app_settings.id
}

output "linked_service_ids" {
  description = "Services the environment group is linked to."
  value       = render_env_group_link.app_settings.service_ids
}

output "managed_settings" {
  description = "Non-secret settings Terraform applies to the web service."
  value = {
    JWT_EXPIRES_IN      = var.jwt_expires_in
    AUTH_RATE_LIMIT_MAX = var.auth_rate_limit_max
  }
}
