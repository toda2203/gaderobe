Jetzt Richtig:
Phase 1: Vorbereitung (lokal)


Backend/.env Datei Sauber befüllen


Ssh daniel@10.56.131.165

sudo mkdir -p /opt/bekleidung/backend 
sudo mkdir -p /opt/bekleidung/frontend
sudo chown daniel:daniel /opt/bekleidung


#prüfen:

ls -la /opt/bekleidung/
ls -la /opt/bekleidung/backend/
ls -la /opt/bekleidung/frontend/

Phase 3: Dateien hochladen (lokal - Terminal)


# Lokal (PowerShell):
cd \\de401850sahapp\wwwroot\productiv\bekleidung

# Backend
scp -r backend/src daniel@10.56.131.165:/opt/bekleidung/backend/
scp -r backend/prisma daniel@10.56.131.165:/opt/bekleidung/backend/
scp backend/package.json daniel@10.56.131.165:/opt/bekleidung/backend/
scp backend/package-lock.json daniel@10.56.131.165:/opt/bekleidung/backend/
scp backend/tsconfig.json daniel@10.56.131.165:/opt/bekleidung/backend/
scp backend/Dockerfile daniel@10.56.131.165:/opt/bekleidung/backend/

# Frontend
scp -r frontend/src daniel@10.56.131.165:/opt/bekleidung/frontend/
scp -r frontend/public daniel@10.56.131.165:/opt/bekleidung/frontend/
scp frontend/package.json daniel@10.56.131.165:/opt/bekleidung/frontend/
scp frontend/package-lock.json daniel@10.56.131.165:/opt/bekleidung/frontend/
scp frontend/tsconfig.json daniel@10.56.131.165:/opt/bekleidung/frontend/
scp frontend/tsconfig.node.json daniel@10.56.131.165:/opt/bekleidung/frontend/
scp frontend/vite.config.ts daniel@10.56.131.165:/opt/bekleidung/frontend/
scp frontend/index.html daniel@10.56.131.165:/opt/bekleidung/frontend/
scp frontend/Dockerfile daniel@10.56.131.165:/opt/bekleidung/frontend/
scp frontend/nginx-ssl.conf daniel@10.56.131.165:/opt/bekleidung/frontend/

# Config
scp docker-compose.portainer.yml daniel@10.56.131.165:/opt/bekleidung/
scp backend/.env daniel@10.56.131.165:/opt/bekleidung/.env


Phase 4: Volumes & SSL (SSH)



ssh daniel@10.56.131.165

ggf. env anpassen wenn nicht schon passiert:

nano /opt/bekleidung/.env

# Volumes erstellen
docker volume create bekleidung_bekleidung-data
docker volume create bekleidung_bekleidung-uploads
docker volume create bekleidung_bekleidung-backups
docker volume create bekleidung_bekleidung-logs
docker volume create bekleidung_bekleidung-ssl

# SSL-Zertifikate generieren
SSL_DIR=$(docker volume inspect bekleidung_bekleidung-ssl --format '{{.Mountpoint}}')

sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$SSL_DIR/key.pem" \
  -out "$SSL_DIR/cert.pem" \
  -subj "/C=DE/ST=BW/L=Nuertingen/O=Graupner/CN=10.56.131.165"

sudo chown 644 "$SSL_DIR/cert.pem"
sudo chown 600 "$SSL_DIR/key.pem"

# Verzeichnis wechseln
cd /opt/bekleidung

Phase 5: Docker Images bauen

# Backend bauen
docker build -t bekleidung-backend:latest ./backend

Viel Zeit 300 sek

# Frontend bauen
docker build -t bekleidung-frontend:latest ./frontend


Phase 6: Stack starten

# Stack starten
docker compose -f docker-compose.portainer.yml up -d

# Warten auf Startup (30 Sekunden)
sleep 30

# Status prüfen
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Logs prüfen
docker logs bekleidung-backend-prod --tail 20
docker logs bekleidung-frontend-prod --tail 20

Phase 7: Test (Browser)
https://10.56.131.165:3078

Einem Benutzer muss die Adminrolle zugewiesen werden:

docker exec -i bekleidung-backend-prod npx prisma db execute --stdin <<EOF
UPDATE employees SET role = 'ADMIN' WHERE email = 'd.troks@autohaus-graupner.de';
EOF

Auto Backup: 

/var/lib/docker/volumes/bekleidung_bekleidung-backups/_data/

ssh daniel@10.56.131.165

# Container stoppen und löschen
docker stop bekleidung-backend-prod bekleidung-frontend-prod 2>/dev/null || true
docker rm bekleidung-backend-prod bekleidung-frontend-prod 2>/dev/null || true

# Images löschen
docker rmi bekleidung-backend:latest bekleidung-frontend:latest 2>/dev/null || true

# Volumes löschen
docker volume rm bekleidung_bekleidung-data bekleidung_bekleidung-uploads bekleidung_bekleidung-backups bekleidung_bekleidung-logs bekleidung_bekleidung-ssl 2>/dev/null || true

# Verzeichnis löschen
sudo rm -rf /opt/bekleidung

# Neu erstellen mit Berechtigungen
sudo mkdir -p /opt/bekleidung/backend /opt/bekleidung/frontend
sudo chown -R daniel:daniel /opt/bekleidung

# Überprüfen
docker ps | grep bekleidung
docker images | grep bekleidung
docker volume ls | grep bekleidung
ls -la /opt/bekleidung

echo "✅ Alles gelöscht - Stand 0!"



Productiv vs Development in der env Datei anpassen und anschlißend:

cd /opt/bekleidung && docker compose -f docker-compose.portainer.yml down backend && sleep 2 && docker compose -f docker-compose.portainer.yml up -d backend && sleep 5 && docker logs bekleidung-backend-prod 2>&1 | grep "EMAIL SERVICE"




Github:

cd /opt/bekleidung
git add .
git commit -m "Feature: Neue Filteroptionen im Dashboard hinzugefügt"
git push origin main