#!/usr/bin/env bash

set -euo pipefail

if [ ! -f "certs/helperai_dev.crt" ]; then
    # Check if mkcert is installed
    if ! command -v mkcert &> /dev/null; then
      echo "mkcert is not installed. Please install it first:"
      echo "  brew install mkcert (macOS)"
      echo "  choco install mkcert (Windows)"
      echo "  apt install mkcert (Ubuntu/Debian) or visit https://github.com/FiloSottile/mkcert"
      exit 1
    fi

    # Install local CA if not already installed
    mkcert -install

    # Create certs directory if it doesn't exist
    mkdir -p certs
    cd certs

    # Generate certificates
    echo "Generating certificates for helperai.dev..."
    mkcert helperai.dev "*.helperai.dev"
    mv helperai.dev+1.pem helperai_dev.crt
    mv helperai.dev+1-key.pem helperai_dev.key

    echo "SSL certificates generated successfully in certs/"
fi
