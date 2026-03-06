#!/usr/bin/env bash
#
# Generates the RSASSA-PSS SHA-256 CRL test fixture.
# Requires OpenSSL 3.x. Output goes to the same directory as this script.
#
# Usage:
#   ./test/unit/agent/crl_validator/fixtures/generate.sh
#
set -euo pipefail

FIXTURES_DIR="$(cd "$(dirname "$0")" && pwd)"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

echo "Generating pss_sha256 fixture..."

(
  cd "$TMPDIR"

  mkdir -p demoCA/newcerts
  touch demoCA/index.txt
  echo '01' > demoCA/serial
  echo '01' > demoCA/crlnumber
  cat > openssl.cnf <<'EOF'
[ca]
default_ca = CA_default
[CA_default]
database = demoCA/index.txt
serial = demoCA/serial
crlnumber = demoCA/crlnumber
new_certs_dir = demoCA/newcerts
default_md = sha256
default_crl_days = 3650
EOF

  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out ca.key 2>/dev/null

  openssl req -new -x509 -key ca.key -out ca.pem \
    -days 3650 -subj "/CN=Test PSS CA/O=Snowflake Test" \
    -sha256 \
    -sigopt rsa_padding_mode:pss \
    -sigopt rsa_pss_saltlen:32 \
    -sigopt rsa_mgf1_md:sha256 2>/dev/null

  openssl ca -gencrl -keyfile ca.key -cert ca.pem \
    -config openssl.cnf -out crl.pem \
    -md sha256 \
    -sigopt rsa_padding_mode:pss \
    -sigopt rsa_pss_saltlen:32 \
    -sigopt rsa_mgf1_md:sha256 2>/dev/null

  openssl crl -in crl.pem -outform DER -out crl.der 2>/dev/null
)

cp "$TMPDIR/ca.pem" "$FIXTURES_DIR/pss_sha256_ca.pem"
cp "$TMPDIR/crl.der" "$FIXTURES_DIR/pss_sha256.crl"

echo "Done. Files written to $FIXTURES_DIR"
