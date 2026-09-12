#!/usr/bin/env bash
set -euo pipefail

# Authenticate for Terraform + gcloud. Uses browser OAuth — never put passwords in scripts.
# Prerequisites: https://cloud.google.com/sdk/docs/install

if ! command -v gcloud >/dev/null 2>&1; then
  if [ -x "$HOME/google-cloud-sdk/bin/gcloud" ]; then
    export PATH="$HOME/google-cloud-sdk/bin:$PATH"
  else
    echo "Install Google Cloud SDK first:"
    echo "  brew install --cask google-cloud-sdk"
    exit 1
  fi
fi

# gcloud ya no corre en Python 3.9 (el del sistema en macOS).
if ! python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
  UV_PY="$HOME/.local/share/uv/python/cpython-3.12-macos-aarch64-none/bin/python3.12"
  if [ -x "$UV_PY" ]; then
    export CLOUDSDK_PYTHON="$UV_PY"
  else
    echo "Instala Python 3.12 y exporta CLOUDSDK_PYTHON antes de usar gcloud."
    exit 1
  fi
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
