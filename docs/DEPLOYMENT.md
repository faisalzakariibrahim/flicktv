# FlickTV AI — Deployment Guide

## Prerequisites
- VPS with 2GB+ RAM (DigitalOcean, AWS EC2, Hetzner)
- Docker + Docker Compose installed
- Domain name with DNS configured
- SSL certificate (Let's Encrypt)

## Quick Deploy

### 1. Server Setup
```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin
```

### 2. Clone & Configure
```bash
git clone https://github.com/faisalzakariibrahim/Flicktv.git
cd Flicktv/backend
cp .env.example .env
nano .env  # Fill in your values
```

### 3. SSL Certificate
```bash
sudo apt install certbot
sudo certbot certonly --standalone -d flicktv.ai
# Copy to ssl/
cp /etc/letsencrypt/live/flicktv.ai/fullchain.pem ssl/
cp /etc/letsencrypt/live/flicktv.ai/privkey.pem ssl/
```

### 4. Launch
```bash
docker-compose up -d
docker-compose logs -f api  # Watch logs
```

### 5. Database
- Go to Supabase dashboard
- SQL Editor → Run `database/migrations/001_initial_schema.sql`

## App Store Submission

### iOS (App Store)
1. Run `eas build --platform ios`
2. Upload to App Store Connect
3. Fill in description emphasizing "personal IPTV player"
4. Category: Entertainment
5. Age rating: 4+

### Android (Google Play)
1. Run `eas build --platform android`
2. Upload to Play Console
3. Store listing: "IPTV player for your own subscriptions"
4. Content rating: Everyone

## Environment Checklist
- [ ] SUPABASE_URL + SUPABASE_SERVICE_KEY
- [ ] ANTHROPIC_API_KEY
- [ ] JWT_SECRET (32+ random chars)
- [ ] REDIS_URL
- [ ] ALLOWED_ORIGINS (your domains)
