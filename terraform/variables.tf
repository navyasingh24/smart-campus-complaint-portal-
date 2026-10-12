variable "render_service_id" {
  description = "ID of the existing web service created by the render.yaml Blueprint (srv-...). Terraform only links the settings group to it; it does not manage the service itself."
  type        = string

  validation {
    condition     = can(regex("^srv-[a-z0-9]+$", var.render_service_id))
    error_message = "render_service_id must look like srv-xxxxxxxxxxxx (Render > service > Settings, or the dashboard URL)."
  }
}

variable "env_group_name" {
  description = "Name of the Render environment group managed by Terraform."
  type        = string
  default     = "smart-campus-app-settings"
}

variable "jwt_expires_in" {
  description = "Login token lifetime read by the backend (JWT_EXPIRES_IN). Default matches the application's built-in default."
  type        = string
  default     = "8h"

  validation {
    condition     = can(regex("^[0-9]+[smhd]$", var.jwt_expires_in))
    error_message = "jwt_expires_in must be a number followed by s, m, h or d, for example 8h."
  }
}

variable "auth_rate_limit_max" {
  description = "Maximum login/registration attempts per IP per 15 minutes (AUTH_RATE_LIMIT_MAX). Default matches the application's built-in default."
  type        = number
  default     = 20

  validation {
    condition     = var.auth_rate_limit_max >= 5 && var.auth_rate_limit_max <= 1000
    error_message = "auth_rate_limit_max must be between 5 and 1000."
  }
}
