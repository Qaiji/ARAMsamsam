# ARAMsamsam Current State

Stand: 2026-05-22

## Kurzfazit

Die Anwendung ist eine kleine Node/Express-App mit statischem Vanilla-Frontend. Es gibt keinen Build-Schritt und keine Datenbank. Die App ist inzwischen fuer Jenkins/PM2 vorbereitet und trennt App-Code von lokalen JSON-Daten.

Der wichtigste Punkt fuer den Betrieb: produktive Daten und Tokens liegen unter `data/` bzw. auf dem Server unter `C:\apps\aramsamsam\data`. Ein Jenkins-Deploy darf diesen Ordner nicht ueberschreiben.

## Projektstruktur

```text
.
+-- server.js
+-- src/
|   +-- server/
|   |   +-- index.js
|   |   +-- storage.js
|   +-- web/
|   |   +-- aram.html
|   |   +-- script.js
|   |   +-- style.css
+-- data/                  # lokal ignoriert, produktive Daten
|   +-- users.json
|   +-- champs-cache.json
|   +-- champs/
+-- package.json
+-- package-lock.json
+-- Jenkinsfile
+-- ecosystem.config.cjs
```

## Runtime

- Backend: Express 5 in `src/server/index.js`
- Start-Wrapper: `server.js`
- Frontend: statisches HTML/CSS/JS in `src/web/`
- Start: `npm start`, intern `node server.js`
- Dev: `npm run dev`, intern `node --watch server.js`
- Port: `process.env.PORT || 7071`
- Healthcheck: `GET /health`
- Node-Version: praktisch Node 18+, empfohlen Node 20 oder 22 LTS
- Build-Schritt: keiner
- Test-Schritt: keiner, `npm test` ist aktuell ein Platzhalter und schlaegt absichtlich fehl

## API

Die API ist in `server.js` definiert:

- `GET /`
- `GET /health`
- `GET /api/leaderboard`
- `POST /api/auth/validate`
- `GET /api/all-champs`
- `GET /api/player-champs/:username`
- `POST /api/player-champs`

Das Frontend nutzt relative URLs (`API_BASE = '.'`), was fuer Betrieb hinter Nginx/Caddy unter derselben Domain gut ist.

## Datenmodell heute

### User und Tokens

`data/users.json` enthaelt ein Array aus Objekten:

```json
[
  { "name": "PlayerName", "token": "uuid-token" }
]
```

Tokens werden beim Start in Memory geladen und danach per Map geprueft. Es gibt aktuell keine Token-Erzeugung und keine Admin-Rolle.

`moreusers.json` war eine alte Import-/Hilfsdatei und gehoert nicht mehr in den App-Root.

### Spielerfortschritt

Pro Spieler existiert eine Datei unter `data/champs/<username>.json`. Diese Datei enthaelt ein Array aus Champion-Namen:

```json
[
  "Ahri",
  "Akshan"
]
```

Gefundene Fortschrittsstaende:

- Hofi: 41 Champions
- Jay: 171 Champions
- Lionvader: 147 Champions
- Medua: 45 Champions
- RiverPrince: 169 Champions
- Viiper: 1 Champion

### Champion-Masterdaten

Die App laedt Champion-Metadaten beim Start von Riot Data Dragon:

- `https://ddragon.leagueoflegends.com/api/versions.json`
- `https://ddragon.leagueoflegends.com/cdn/<version>/data/en_US/champion.json`

`data/champs-cache.json` enthaelt Champion-Objekte mit `name`, `completed`, `imageUrl` und `id`. Diese Datei dient als lokaler Fallback, falls Data Dragon nicht erreichbar ist oder lokal `SKIP_DDRAGON=1` gesetzt wird.

## Authentifizierung

- Nutzer geben im Frontend einen Token ein.
- Der Token wird im Browser in `localStorage` gespeichert.
- `POST /api/auth/validate` prueft, ob der Token in `data/users.json` bzw. der ueber `USERS_FILE` konfigurierten Datei existiert.
- Schreibzugriff auf `POST /api/player-champs` ist tokengebunden.
- Lesen von Leaderboard, Championliste und Spielerfortschritt ist ohne Auth moeglich.

## Risiken

### Datenverlust beim Deploy

Wenn Jenkins ein frisches Checkout macht, `git clean` nutzt oder das Release-Verzeichnis ersetzt, darf `data/` nicht Teil des Deploy-Artefakts sein. Auf dem Server liegt es getrennt unter `C:\apps\aramsamsam\data`.

### Secrets im Repo

Klartext-Tokens liegen in der lokalen/produktiven Daten-Datei. Diese Datei ist per `.gitignore` ausgeschlossen und sollte nicht in ein oeffentliches GitHub-Repo. Bereits veroeffentlichte Tokens sollten als kompromittiert betrachtet und neu erzeugt werden.

### Datei-Writes

Der Fortschritt wird pro Save als komplette JSON-Datei geschrieben. Es gibt keine atomaren Writes, keine Queue pro User und keinen Schutz gegen parallele Saves aus mehreren Tabs.

### PM2-Instanzen

Mit JSON-Dateien sollte PM2 nur eine Instanz starten (`instances: 1`). Mehrere Instanzen haetten getrennten In-Memory-State und koennten Daten ueberschreiben.

### Externe Abhaengigkeit beim Start

Die App laedt Data Dragon vor `listen()`. Wenn Riot langsam oder nicht erreichbar ist, kann der Start verzoegert werden oder mit leerem Champion-Cache laufen.

### Sicherheit

- CORS ist offen fuer alle Origins.
- Keine Rate Limits.
- Keine Security-Header.
- Tokens liegen in `localStorage`.
- Champion-Eingaben werden nur als String geprueft, nicht gegen bekannte Champion-IDs validiert.

## Git-Zustand

Das Repository hat aktuell noch keinen Commit. Fuer Jenkins/GitHub braucht es einen sauberen Initial Commit mit Code, Konfiguration und Docs, aber ohne `data/`, produktive Tokens oder alte Importdateien.
