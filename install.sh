#!/bin/bash

# --- DICE2 AUTO-INSTALLER & DEPLOYER ---
echo "🚀 Memulai proses instalasi Dice2..."

# 1. Cek Node.js & NPM
if ! command -v node &> /dev/null; then
    echo "❌ Node.js belum terinstall. Harap install Node.js minimal v18+."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Versi Node.js kamu ($NODE_VERSION) terlalu rendah. Gunakan v18 atau lebih baru."
    exit 1
fi
echo "✅ Node.js $(node -v) terdeteksi."

# 2. Install System Dependencies (Canvas & Fonts Support)
echo "📦 Menginstall dependencies sistem (Cairo, Pango, dkk)..."
sudo apt-get update
sudo apt-get install -y libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev build-essential

# 3. Cek & Install PM2
if ! command -v pm2 &> /dev/null; then
    echo "⚙️ PM2 tidak ditemukan. Menginstall PM2 secara global..."
    sudo npm install -g pm2
fi
echo "✅ PM2 terinstall."

# 4. Install NPM Dependencies tiap folder
echo "📂 Menginstall dependencies NPM..."

echo "🔹 Folder root..."
npm install

echo "🔹 Folder API..."
cd api && npm install && cd ..

echo "🔹 Folder Bot..."
cd bot && npm install && cd ..

echo "🔹 Folder Dashboard..."
cd dashboard && npm install && cd ..

# 5. Build Dashboard (Next.js)
echo "🏗️ Memulali proses Build Dashboard (Next.js Production)..."
cd dashboard
npm run build
cd ..

# 6. Jalankan via PM2
echo "🚀 Menjalankan aplikasi via PM2..."

# Hapus dulu kalau ada proses lama biar gak bentrok
pm2 delete dice-api dice-bot dice-dashboard 2>/dev/null || true

# Start menggunakan ecosystem file
pm2 start ecosystem.config.js

# Simpan save PM2 agar auto-start saat reboot
pm2 save

echo "--------------------------------------------------"
echo "🎉 INSTALASI SELESAI BOSKU! 🔥"
echo "Cek status aplikasi dengan: pm2 list"
echo "Cek log dashboard dengan: pm2 logs dice-dashboard"
echo "--------------------------------------------------"
