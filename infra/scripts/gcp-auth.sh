#!/usr/bin/env bash
set -euo pipefail

# Authenticate for Terraform + gcloud. Uses browser OAuth — never put passwords in scripts.
# Prerequisites: https://cloud.google.com/sdk/docs/install

if ! command -v gcloud >/dev/null 2>&1; then
  echo "Install Google Cloud SDK first:"
  echo "  brew install --cask google-cloud-sdk"
  exit 1
fi

gcloud auth login
gcloud auth application-default login

echo ""
echo "Set your project (create one in console if needed):"
echo "  gcloud projects create fastroute-demo --name='FastRoute Demo'"
echo "  gcloud config set project YOUR_PROJECT_ID"
echo ""
echo "Then copy infra/terraform/terraform.tfvars.example to terraform.tfvars and run:"
echo "  cd infra/terraform && terraform init && terraform plan"
