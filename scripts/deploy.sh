#!/bin/bash
set -e

echo "🚀 Deploying Blockbuster Agentic Studio to Google Cloud..."

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-blockbuster-agentic-studio}"
REGION="${GCP_REGION:-us-central1}"

echo "📋 Project: $PROJECT_ID"
echo "🌍 Region: $REGION"

echo "🔐 Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  sqladmin.googleapis.com \
  monitoring.googleapis.com \
  --project="$PROJECT_ID"

echo "🏗️  Building and deploying API service..."
gcloud run deploy blockbuster-agentic-api \
  --source=. \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --set-env-vars=NODE_ENV=production \
  --project="$PROJECT_ID"

echo "✅ Deployment complete!"
