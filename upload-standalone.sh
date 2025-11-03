#!/bin/bash

echo "═══════════════════════════════════════════════════════════════"
echo "  🚀 Uploading Cookie Consent VE Standalone to FTP"
echo "═══════════════════════════════════════════════════════════════"

echo ""
echo "[1/6] Preparing FTP upload..."
echo "Target: ftp.karmaestate.ro / vesrl.ro"

# Using existing FTP credentials pattern
cat > ftp_standalone.txt << 'EOF'
user boss@bossbaby.ro O_b;u1?~$T#c@^WB
binary
put index.html index.html
put cookie-consent-standalone.js cookie-consent-standalone.js
put standalone-example.html standalone-example.html
put auto-gate-demo.html auto-gate-demo.html
put test-debug.html test-debug.html
quit
EOF

echo "[2/6] Files to upload:"
echo "  - index.html (main landing page)"
echo "  - cookie-consent-standalone.js (main script)"
echo "  - standalone-example.html (example demo)"
echo "  - auto-gate-demo.html (auto-gating demo)"
echo "  - test-debug.html (debug tools)"

echo "[3/6] Connecting to FTP server..."
ftp -n ftp.karmaestate.ro < ftp_standalone.txt
ftp_exit_code=$?

echo "[4/6] FTP exit code: ${ftp_exit_code}"

echo "[5/6] Cleaning up temporary files..."
rm -f ftp_standalone.txt

echo "[6/6] Upload complete!"
echo ""
echo "═══════════════════════════════════════════════════════════════"

if [ ${ftp_exit_code} -eq 0 ]; then
  echo "  ✅ Upload successful!"
  echo ""
  echo "Files available at:"
  echo "  - https://vesrl.ro/ (or http://vesrl.ro/)"
  echo "  - https://vesrl.ro/index.html"
  echo "  - https://vesrl.ro/auto-gate-demo.html"
  echo "  - https://vesrl.ro/standalone-example.html"
  echo ""
else
  echo "  ❌ Upload failed!"
  echo "  Check FTP credentials and server connection."
  echo ""
fi
