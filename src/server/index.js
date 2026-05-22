const cors = require('cors');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const { JsonStorage, validUsername } = require('./storage');
const { buildLeaderboardDescription, renderHomeHtml } = require('./meta');

const ROOT_DIR = path.join(__dirname, '..', '..');
const WEB_DIR = path.join(__dirname, '..', 'web');
const HOME_HTML = path.join(WEB_DIR, 'aram.html');

const PORT = Number(process.env.PORT || 7071);
const CHAMPS_DIR = process.env.CHAMPS_DIR || path.join(ROOT_DIR, 'data', 'champs');
const USERS_FILE = process.env.USERS_FILE || path.join(ROOT_DIR, 'data', 'users.json');
const FALLBACK_CHAMPS_FILE = process.env.FALLBACK_CHAMPS_FILE || path.join(ROOT_DIR, 'data', 'champs-cache.json');

const app = express();
const storage = new JsonStorage({ usersFile: USERS_FILE, champsDir: CHAMPS_DIR });

app.use(
    cors({
        origin(origin, callback) {
            const allowed = String(process.env.CORS_ORIGIN || '')
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean);

            if (!origin || allowed.length === 0 || allowed.includes(origin)) {
                callback(null, true);
                return;
            }

            callback(new Error('Origin not allowed by CORS'));
        },
    })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.static(WEB_DIR));

let allChampsCache = [];

function getToken(req) {
    return String(req.headers['x-auth-token'] || req.body?.token || '').trim();
}

function requireAuth(req, res, next) {
    const token = getToken(req);
    if (!token) return res.status(401).json({ error: 'Missing token' });

    const user = storage.findUserByToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    req.user = user;
    next();
}

function requireAdmin(req, res, next) {
    requireAuth(req, res, () => {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin role required' });
        next();
    });
}

async function loadAllChamps() {
    await reloadAllChamps();

    setInterval(async () => {
        await reloadAllChamps();
    }, 24 * 60 * 60 * 1000);
}

async function reloadAllChamps() {
    try {
        if (process.env.SKIP_DDRAGON === '1') {
            await loadFallbackChamps();
            return;
        }

        const versionsRes = await fetchWithTimeout('https://ddragon.leagueoflegends.com/api/versions.json');
        const versions = await versionsRes.json();
        const latest = versions[0];

        const champRes = await fetchWithTimeout(`https://ddragon.leagueoflegends.com/cdn/${latest}/data/en_US/champion.json`);
        const champData = await champRes.json();

        const allChamps = Object.values(champData.data).map((champ) => ({
            name: champ.name,
            imageUrl: `https://ddragon.leagueoflegends.com/cdn/${latest}/img/champion/${champ.image.full}`,
            id: champ.id,
        }));

        allChamps.sort((a, b) => a.name.localeCompare(b.name));
        allChampsCache = allChamps;
    } catch (error) {
        console.error('Failed loading all champs from Data Dragon:', error.message);
        await loadFallbackChamps();
    }
}

async function fetchWithTimeout(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
        return response;
    } finally {
        clearTimeout(timeout);
    }
}

async function loadFallbackChamps() {
    try {
        const raw = await fs.readFile(FALLBACK_CHAMPS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;

        allChampsCache = parsed
            .filter((champ) => champ && typeof champ.name === 'string')
            .map((champ) => ({
                name: champ.name,
                imageUrl: champ.imageUrl || '',
                id: champ.id || champ.name,
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
        console.error('Failed loading fallback champs:', error.message);
        allChampsCache = [];
    }
}

function normalizePostedChamps(req) {
    const data = req.body?.champs ?? req.body;
    const champsArray = Array.isArray(data) ? data : req.body?.champs;

    if (!Array.isArray(champsArray)) {
        return { error: 'Body must be an array of champs or { champs: [...] }' };
    }

    for (let i = 0; i < champsArray.length; i++) {
        if (typeof champsArray[i] !== 'string') {
            return { error: `Item ${i} must be a string` };
        }
    }

    const knownChampNames = new Set(allChampsCache.map((champ) => champ.name));
    const normalized = Array.from(new Set(champsArray)).sort((a, b) => a.localeCompare(b));
    const invalid = knownChampNames.size ? normalized.find((champ) => !knownChampNames.has(champ)) : undefined;
    if (invalid) return { error: `Unknown champion: ${invalid}` };

    return { champs: normalized };
}

app.get('/api/leaderboard', (_req, res) => {
    try {
        const total = Array.isArray(allChampsCache) ? allChampsCache.length : 0;

        const rows = storage.listUsers().map((u) => {
            const count = storage.getPlayerChamps(u.name).length;
            const pct = total ? +((100 * count) / total).toFixed(2) : 0;
            return { name: u.name, count, total, pct };
        });

        rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

        let rank = 0;
        let lastCount = Infinity;
        rows.forEach((r) => {
            if (r.count !== lastCount) {
                rank += 1;
                lastCount = r.count;
            }
            r.rank = rank;
        });

        res.json({ total, leaderboard: rows });
    } catch (e) {
        console.error('GET /api/leaderboard error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/validate', requireAuth, (req, res) => {
    res.json({ user: req.user.name, role: req.user.role });
});

app.get('/api/all-champs', (_req, res) => {
    res.json({ champs: allChampsCache });
});

app.get('/api/player-champs/:username', (req, res) => {
    const username = req.params.username;
    if (!validUsername(username)) return res.status(400).json({ error: 'Invalid username' });

    res.json({ user: username, champs: storage.getPlayerChamps(username) });
});

app.post('/api/player-champs', requireAuth, async (req, res) => {
    try {
        const normalized = normalizePostedChamps(req);
        if (normalized.error) return res.status(400).json({ error: normalized.error });

        const champs = await storage.setPlayerChamps(req.user.name, normalized.champs);
        res.json({ ok: true, user: req.user.name, count: champs.length });
    } catch (error) {
        console.error('POST /api/player-champs error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/admin/users', requireAdmin, (_req, res) => {
    res.json({ users: storage.listUsers() });
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const name = String(req.body?.name || '').trim();
        const role = req.body?.role === 'admin' ? 'admin' : 'player';
        const created = await storage.createUser({ name, role });

        res.status(201).json({
            user: { name: created.name, role: created.role },
            token: created.token,
        });
    } catch (error) {
        const message = error.message || 'Server error';
        const status = /Invalid username|already exists/.test(message) ? 400 : 500;
        res.status(status).json({ error: message });
    }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/', async (_req, res) => {
    try {
        const description = buildLeaderboardDescription({
            users: storage.listUsers(),
            getPlayerChamps: (name) => storage.getPlayerChamps(name),
            total: allChampsCache.length,
        });
        const html = await renderHomeHtml({ htmlPath: HOME_HTML, description });
        res.type('html').send(html);
    } catch (error) {
        console.error('GET / error:', error);
        res.sendFile(HOME_HTML);
    }
});

async function init() {
    await storage.init();

    console.log(`Using users file: ${USERS_FILE}`);
    console.log(`Using champs dir: ${CHAMPS_DIR}`);
    app.listen(PORT, () => console.log(`LoL champs API running on http://localhost:${PORT}`));

    await loadAllChamps();
}

module.exports = { app, storage, init };
