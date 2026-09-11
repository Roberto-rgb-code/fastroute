variable "project_id" {
  description = "GCP project ID (create in console or gcloud)"
  type        = string
}

variable "region" {
  description = "Primary GCP region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment label (demo, staging, prod)"
  type        = string
  default     = "demo"
}

variable "billing_account_id" {
  description = "Optional billing account to link new project"
  type        = string
  default     = ""
}
