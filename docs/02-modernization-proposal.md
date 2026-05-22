# ARAMsamsam Modernization Proposal

Stand: 2026-05-22

## Ziel

Die App soll minimal umgebaut werden, aber sauber ueber GitHub und Jenkins deploybar sein, dauerhaft Daten behalten, mit PM2 automatisch neu starten und einen einfachen Admin-Modus zum Anlegen neuer Nutzer/Tokens bekommen.

Design und Frontend sollen weitgehend bleiben. Die wichtigste Arbeit liegt bei Deployment, Persistenz, Token-Verwaltung und Betriebsrobustheit.

## Empfohlener Zielstack

### Basis

- GitHub als Source of Truth
- Jenkins fuer automatisches Deployment
- Node.js 20 oder 22 LTS auf dem Server
- PM2 als Process Manager
- Nginx oder Caddy als Reverse Proxy mit TLS
- Eine Node/Express-App, weiter mit statischem Frontend

### Persistenz

Empfehlung: zunaechst keine grosse Framework-Migration. Die API bleibt gleich, aber die Datenzugriffe werden hinter ein Storage-Modul gelegt.

Danach gibt es zwei realistische Optionen:

1. JSON-Dateien ausserhalb des Checkouts
2. Postgres

Meine Empfehlung ist Postgres, weil ohnehin eine Server-DB vorhanden ist und der Admin-Modus dadurch deutlich sauberer wird. Falls du es maximal klein halten willst, kann JSON fuer Phase 1 bleiben, aber nur mit persistentem Datenverzeichnis, atomaren Writes und einer Write-Queue.

## Option A: Gehaertete JSON-Persistenz

Geeignet, wenn:

- nur eine PM2-Instanz laeuft
- die App klein und privat bleibt
- du keine DB-Migration jetzt willst

Ziel:

- App-Code unter `/opt/aramsamsam/app`
- Produktive Daten unter `/var/lib/aramsamsam`
- `USERS_FILE=/var/lib/aramsamsam/users.json`
- `CHAMPS_DIR=/var/lib/aramsamsam/champs`
- PM2 mit `instances: 1`

Notwendige Aenderungen:

- `USERS_FILE` und `CHAMPS_DIR` aus Environment lesen
- `.gitignore` fuer echte Daten/Secrets
- `.env.example`
- atomare Writes fuer `champs/*.json`
- Usernamen validieren, bevor Dateipfade gebaut werden
- Admin-Endpoint schreibt neue User in `USERS_FILE`
- Tokens mit `crypto.randomBytes(32).toString('base64url')` erzeugen

Nachteil:

- Parallele Deploys/mehrere Instanzen bleiben schwierig
- Token-Hashing ist moeglich, aber JSON wird mit Admin-Modus schnell empfindlicher
- Backups muessen dateibasiert geloest werden

## Option B: Postgres-Persistenz

Geeignet, wenn:

- Daten sicher ueber Deploys hinweg bleiben sollen
- Admin-Modus sauber werden soll
- spaeter mehrere Instanzen oder bessere Backups moeglich sein sollen

Minimal-Schema:

```sql
create table users (
  id bigserial primary key,
  name text not null unique,
  token_hash text not null unique,
  role text not null default 'player',
  created_at timestamptz not null default now()
);

create table player_champs (
  user_id bigint not null references users(id) on delete cascade,
  champion_id text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, champion_id)
);
```

Rollen:

- `player`: kann eigenen Fortschritt speichern
- `admin`: kann neue Spieler anlegen und Tokens erzeugen

Admin darf nicht loeschen, nur anlegen.

Token-Strategie:

- Token wird nur einmal bei Erstellung im Klartext angezeigt.
- Gespeichert wird nur ein Hash, z. B. SHA-256 oder besser HMAC-SHA256 mit Server-Secret.
- Bestehende Tokens werden bei Migration importiert und danach optional rotiert.

Vorteil:

- Deploys koennen App-Code komplett ersetzen, ohne Datenverlust
- Admin-Modus ist natuerlich abbildbar
- Fortschritt ist relational und dedupliziert
- Backups sind Standard-Postgres-Backups

## Jenkins + PM2 Zielbild

### GitHub

Committen:

- `server.js`
- `package.json`
- `package-lock.json`
- `src/web/`
- `docs/`
- `.gitignore`
- `.env.example`
- `ecosystem.config.cjs`
- `Jenkinsfile`

Nicht committen:

- `node_modules/`
- `.env`
- `aramsam.zip`
- echte produktive `users.json`
- echte produktive `champs/*.json`, falls JSON-Persistenz bleibt

### Jenkins Pipeline

Minimaler Ablauf:

1. Checkout aus GitHub
2. Node-Version sicherstellen
3. `npm ci`
4. Syntaxcheck fuer Server und Frontend
5. Deploy auf Server
6. PM2 `startOrReload`
7. Healthcheck gegen `/health`

Solange es keine echten Tests gibt, sollte Jenkins nicht `npm test` ausfuehren, weil dieser Befehl aktuell absichtlich fehlschlaegt.

### PM2

Empfohlene Datei: `ecosystem.config.cjs`

Wichtige Einstellungen:

- `name: 'aramsamsam'`
- `script: 'server.js'`
- `instances: 1`
- `exec_mode: 'fork'`
- `max_memory_restart`
- `env_production` mit `NODE_ENV`, `PORT` und Datenpfaden oder `DATABASE_URL`

## Minimaler Umbauplan

### Phase 1: Repo und Betrieb absichern

- `.gitignore` erstellen
- `.env.example` erstellen
- README oder Deployment-Doku ergaenzen
- `package.json` korrigieren (`main: server.js`, Node engines, Smoke-Scripts)
- `ecosystem.config.cjs` ergaenzen
- `Jenkinsfile` ergaenzen
- produktive Tokens und `aramsam.zip` aus Git heraushalten

Ergebnis: GitHub/Jenkins/PM2 funktionieren, ohne die App fachlich zu veraendern.

### Phase 2: Persistenz entkoppeln

- Storage-Funktionen aus `server.js` in eigenes Modul ziehen
- Datenpfade per ENV oder `DATABASE_URL` konfigurierbar machen
- Data-Dragon-Fallback ueber `data/champs-cache.json` einbauen
- Champion-Input validieren und deduplizieren

Ergebnis: Daten koennen nicht mehr versehentlich vom Deploy ueberschrieben werden.

### Phase 3: Admin-Modus

- User-Modell um `role` erweitern
- Admin-Token erkennen
- API ergaenzen:
  - `GET /api/admin/users`
  - `POST /api/admin/users`
- Frontend nach Login bei Admin-Rolle einen kleinen Admin-Bereich anzeigen
- Neuer User bekommt automatisch generierten Token
- Token wird einmal angezeigt, nicht dauerhaft im UI wiederholbar

Ergebnis: Admin kann neue Spieler anlegen, aber nicht loeschen.

### Phase 4: Optional Postgres

- Migration aus `users.json` und `champs/*.json`
- Tabellen fuer `users` und `player_champs`
- Storage-Modul auf Postgres umstellen
- Docker Compose fuer lokale Postgres-Entwicklung
- Server-Deployment nutzt vorhandene Postgres-Instanz

Ergebnis: robustere Persistenz mit sauberem Backup- und Deploy-Verhalten.

## Empfehlung

Ich wuerde Postgres fuer das Zielsystem nehmen, aber den Umbau so schneiden, dass die App zuerst mit JSON weiterlaufen kann. Das senkt Risiko: Wir koennen Jenkins/PM2 und Git sauber machen, dann das Storage-Modul einfuehren, danach entweder JSON gehaertet betreiben oder auf Postgres wechseln.

Der wichtigste technische Schnitt ist das Storage-Modul unter `src/server/storage.js`. `server.js` bleibt nur ein kleiner Start-Wrapper.
