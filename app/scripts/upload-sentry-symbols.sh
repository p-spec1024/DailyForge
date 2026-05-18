#!/usr/bin/env bash
# S15-T2: upload Flutter debug symbols + source maps to Sentry.
# Called manually post-release. CI integration is deferred to S15-T5.
#
# Required env vars (set before invocation, DO NOT commit):
#   SENTRY_AUTH_TOKEN   - internal-integration auth token from Sentry settings
#   SENTRY_ORG          - Sentry organization slug
#   SENTRY_PROJECT      - Sentry project slug (e.g. dailyforge-flutter)
#
# Usage (from repo root):
#   ./app/scripts/upload-sentry-symbols.sh <version> <build-number>
# Example:
#   ./app/scripts/upload-sentry-symbols.sh 1.4.0 47
#
# Produces a Sentry release named: dailyforge-flutter@<version>+<build>
# matching whatever --dart-define=SENTRY_RELEASE=... the APK was built with.

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <version> <build-number>" >&2
  exit 1
fi

VERSION="$1"
BUILD="$2"
RELEASE="dailyforge-flutter@${VERSION}+${BUILD}"

: "${SENTRY_AUTH_TOKEN:?SENTRY_AUTH_TOKEN not set}"
: "${SENTRY_ORG:?SENTRY_ORG not set}"
: "${SENTRY_PROJECT:?SENTRY_PROJECT not set}"

# cd into app/ (parent of scripts/)
cd "$(dirname "$0")/.."

# Ensure sentry-cli is installed.
if ! command -v sentry-cli >/dev/null 2>&1; then
  echo "sentry-cli not found. Install: https://docs.sentry.io/cli/installation/" >&2
  exit 1
fi

# Create the release if it doesn't already exist.
sentry-cli releases new "$RELEASE"

# Upload Android native debug files (.so symbols).
# iOS .dSYM uploads require running this script on macOS with an Xcode build
# present; the path below is Android-only by default.
sentry-cli debug-files upload \
  --include-sources \
  build/app/intermediates/merged_native_libs/release/out/lib || true

# Finalize the release so events get grouped under it.
sentry-cli releases finalize "$RELEASE"

echo "Sentry release $RELEASE finalized."
