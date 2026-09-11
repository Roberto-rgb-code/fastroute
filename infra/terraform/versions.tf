terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.40"
    }
  }

  # Uncomment after creating GCS bucket for state (see README)
  # backend "gcs" {
  #   bucket = "fastroute-terraform-state"
  #   prefix = "prod"
  # }
}
