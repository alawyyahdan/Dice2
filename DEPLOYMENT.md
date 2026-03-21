# Panduan Deploy Dice2 ke VPS (Ubuntu/Debian)

Agar aplikasi Dice2 (API, Bot, dan Dashboard Next.js) bisa berjalan 24/7 di VPS, kita akan menggunakan **PM2** sebagai process manager dan **Nginx** sebagai reverse proxy (jika kamu mau pakai domain).

## 1. Persiapan Server
Pastikan VPS kamu sudah terinstall **Node.js** (rekomendasi v18/v20) dan **NPM**.

```bash
# Update sistem
sudo apt update && sudo apt upgrade -y

# Install curl (jika belum ada)
sudo apt install curl -y

# Install Node.js v20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 secara global
sudo npm install -g pm2

# depedencies
sudo apt-get install -y libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

```

## 2. Upload / Clone Source Code ke VPS
Upload folder `Dice2` ke VPS kamu, misalnya di folder `/var/www/Dice2` atau `/home/user/Dice2`.

Masuk ke folder project:
```bash
cd /path/ke/folder/Dice2
```

Pastikan file `.env` kamu sudah di-setting dengan benar (URL MongoDB, Token Bot, dll). Jika VPS-nya production, ubah `API_URL` dan variable terkait `localhost` menjadi IP VPS atau Domain kamu.

## 3. Install Dependencies
Masuk ke masing-masing folder dan jalankan `npm install`:

```bash
# Di root folder Dice2 (kalau ada package.json root)
npm install

# Di API
cd api
npm install
cd ..

# Di Bot
cd bot
npm install
cd ..

# Di Dashboard
cd dashboard
npm install
cd ..
```

## 4. Build Dashboard (Next.js)
Dashboard dibangun pakai Next.js, jadi harus di-build dulu untuk mode production:

```bash
cd dashboard
npm run build
cd ..
```

## 5. Menjalankan Semua Service dengan PM2
PM2 akan memastikan aplikasi tetap jalan walau VPS di-restart atau kita tutup terminal.

```bash
# 1. Jalankan API Server
cd /root/Dice2/dashboard && npm run build && cd /root/Dice2 && pm2 start ecosystem.config.js

```

### Menyimpan konfigurasi PM2 agar auto-start saat VPS Reboot:
```bash
pm2 save
pm2 startup
# Ikuti perintah (copy-paste) yang dimunculkan oleh pm2 startup di terminalmu!
```

**Perintah berguna PM2:**
- Mengecek status: `pm2 status`
- Melihat log: `pm2 logs` atau `pm2 logs dice-bot`
- Restart service: `pm2 restart dice-api`

---

## 6. (Opsional) Setting Nginx dengan Domain
Kalau kamu pakai domain asli, sebaiknya gunakan Nginx sebagai reverse proxy.

```bash
# Install Nginx
sudo apt install nginx -y
```

Buat konfig Nginx baru:
```bash
sudo nano /etc/nginx/sites-available/dice
```

Isi dengan (sesuaikan nama domainmu):
```nginx
server {
    listen 80;
    server_name api.domainkamu.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name dashboard.domainkamu.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Aktifkan config Nginx dan restart:
```bash
sudo ln -s /etc/nginx/sites-available/dice /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Selesai! Aplikasi kamu sudah berjalan 24/7 di VPS kamu dalam mode Production.
