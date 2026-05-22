# Windows Deployment

## Zielpfade

```text
C:\apps\aramsamsam\app
C:\apps\aramsamsam\data
C:\apps\aramsamsam\data\champs
```

`app` enthaelt den Git-Checkout. `data` enthaelt produktive JSON-Daten und wird von Jenkins nicht geloescht.

## Caddy

```caddyfile
aram.skyblock.id {
    encode zstd gzip

    reverse_proxy 127.0.0.1:7071

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

Danach Caddy neu laden.

## Daten vorbereiten

Vor dem ersten Deploy die bestehenden Dateien vom alten Stand nach `C:\apps\aramsamsam\data` kopieren:

```powershell
New-Item -ItemType Directory -Force -Path C:\apps\aramsamsam\data\champs
Copy-Item C:\path\to\old\users.json C:\apps\aramsamsam\data\users.json
Copy-Item C:\path\to\old\champs\*.json C:\apps\aramsamsam\data\champs\
Copy-Item C:\path\to\old\champs.json C:\apps\aramsamsam\data\champs-cache.json
```

Mindestens ein User in `users.json` braucht `"role": "admin"`.

## PM2

```powershell
cd C:\apps\aramsamsam\app
npm ci --omit=dev
pm2 startOrReload ecosystem.config.cjs --env production
pm2 save
```

PM2 muss auf dem Server bereits so eingerichtet sein, dass es nach einem Windows-Neustart wieder startet.

## Jenkins

Der `Jenkinsfile` fuehrt aus:

- `npm ci`
- `npm run check`
- `npm test`
- Kopie nach `C:\apps\aramsamsam\app`
- `npm ci --omit=dev`
- `pm2 startOrReload ecosystem.config.cjs --env production`
- Healthcheck gegen `http://127.0.0.1:7071/health`

Produktive Daten in `C:\apps\aramsamsam\data` werden nicht geloescht.

## Lokal testen

Ohne PM2 und Caddy. Wenn `data/` bereits existiert, reichen die Environment-Variablen und `npm start`.

```powershell
New-Item -ItemType Directory -Force -Path .\data\champs
$env:USERS_FILE = "$PWD\data\users.json"
$env:CHAMPS_DIR = "$PWD\data\champs"
$env:FALLBACK_CHAMPS_FILE = "$PWD\data\champs-cache.json"
$env:SKIP_DDRAGON = "1"
$env:CORS_ORIGIN = "http://localhost:7071"
npm start
```

Dann im Browser `http://localhost:7071` oeffnen.
