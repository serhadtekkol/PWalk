# PMAM — Proje Yönetimi Uygulaması

Kanban Board, MS Project benzeri Gantt/WBS/Kritik Yol/İş Yükü görünümleri, Web Push + `ntfy` bildirimleri ve mobil uyumlu REST API (`/api/v1` + `/docs` Swagger) içeren çok kullanıcılı proje yönetim uygulaması.

## Kurulum ve Docker ile Çalıştırma

1. `.env.example` dosyasını `.env` olarak kopyalayın ve MSSQL + JWT + VAPID bilgilerinizi girin:
   ```bash
   cp .env.example .env
   npx web-push generate-vapid-keys
   ```
   - `DATABASE_URL` içinde mevcut Docker `mssql` sunucunuzun şifresini yazın:
     `sqlserver://mssql:1433;database=pmam;user=sa;password=SIFRENIZ;encrypt=true;trustServerCertificate=true`

2. Container'ları oluşturup ayağa kaldırın:
   ```bash
   docker compose up -d --build
   ```
   - Web arayüzü: `http://127.0.0.1:3600`
   - OpenAPI / Swagger dokümantasyonu: `http://127.0.0.1:3600/docs`
   - Sağlık kontrolü: `http://127.0.0.1:3600/api/v1/health`

## Cloudflare Tunnel (`cloudflared`) Bağlantısı

`pmam-web` servisi mevcut `web` Docker ağına bağlıdır. Cloudflare Zero Trust panelinden tünelinize yeni bir Public Hostname ekleyin:
- **Subdomain:** ör. `pm.alanadiniz.com`
- **Service:** `http://pmam-web:80`
