#!/bin/bash

echo "[1/5] Starting CookieConsent-VE upload"
echo "Preparing FTP command file: ftp_official.txt"

cat > ftp_official.txt << 'EOF'
user boss@bossbaby.ro O_b;u1?~$T#c@^WB
binary
put demo/index.html index.html
put demo/settings.html settings.html
put src/cc.js cc.js
put styles/cc.css cc.css
put cookieconsent/dist/cookieconsent.umd.js cookieconsent.umd.js
put cookieconsent/dist/cookieconsent.css cookieconsent.css
quit
EOF

echo "[2/5] FTP target: ftp.karmaestate.ro"
echo "Uploading files via FTP (binary mode)"
ftp -n ftp.karmaestate.ro < ftp_official.txt
ftp_exit_code=$?
echo "FTP exit code: ${ftp_exit_code}"

echo "[3/5] Cleaning up temporary file: ftp_official.txt"
rm -f ftp_official.txt
cleanup_exit_code=$?
echo "Cleanup exit code: ${cleanup_exit_code}"

echo "[4/5] Files expected on server root:"
echo " - index.html (from demo/index.html)"
echo " - cc.js (from src/cc.js)"
echo " - cc.css (from styles/cc.css)"

echo "[5/5] Upload finished"
echo "Test at: http://bossbaby.ro/"

