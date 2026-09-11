provider "google" {
  project = var.project_id
  region  = var.region
}

locals {
  apis = [
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "maps-backend.googleapis.com",
    "geocoding-backend.googleapis.com",
    "directions-backend.googleapis.com",
  ]
}

resource "google_project_service" "apis" {
  for_each = toset(local.apis)

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "fastroute" {
  depends_on = [google_project_service.apis]

  location      = var.region
  repository_id = "fastroute"
  description   = "FastRoute container images"
  format        = "DOCKER"
}

resource "google_service_account" "runtime" {
  account_id   = "fastroute-runtime"
  display_name = "FastRoute Cloud Run runtime"
}

resource "google_project_iam_member" "runtime_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_secret_manager_secret" "jwt_secret" {
  depends_on = [google_project_service.apis]

  secret_id = "fastroute-jwt-secret-${var.environment}"

  replication {
    auto {}
  }
}

# Placeholder version — set real value via: gcloud secrets versions add ...
resource "google_secret_manager_secret_version" "jwt_secret_placeholder" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = "REPLACE_VIA_GCLOUD_AFTER_APPLY"

  lifecycle {
    ignore_changes = [secret_data]
  }
}

output "artifact_registry_url" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.fastroute.repository_id}"
}

output "runtime_service_account" {
  value = google_service_account.runtime.email
}
