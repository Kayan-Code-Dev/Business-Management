#!/usr/bin/env bash
# سكربت النشر على السيرفر - يُشغّل بعد فك ضغط الكود في مجلد التطبيق
# لا يقوم بتشغيل seed حتى لا يستبدل بيانات الإنتاج (مثل كلمة مرور admin)
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "==> App dir: $APP_DIR"

echo "==> Building server..."
cd "$APP_DIR/server"
npm install --no-audit --no-fund
npx prisma generate
npx prisma db push --skip-generate
npm run build

echo "==> Building client..."
cd "$APP_DIR/client"
npm install --no-audit --no-fund
npm run build

echo "==> Restarting service..."
systemctl restart pm-business

sleep 3
if systemctl is-active --quiet pm-business; then
  echo "✅ Deploy complete - service is active"
else
  echo "❌ Service failed to start"
  journalctl -u pm-business -n 20 --no-pager || true
  exit 1
fi
