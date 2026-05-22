const API_BASE = '.';

const UI = {
    tokenOverlay: document.getElementById('tokenOverlay'),
    tokenInput: document.getElementById('tokenInput'),
    tokenError: document.getElementById('tokenError'),
    tokenSubmitBtn: document.getElementById('tokenSubmitBtn'),

    grid: document.getElementById('grid'),
    search: document.getElementById('search'),
    status: document.getElementById('status'),
    hideCompleted: document.getElementById('hideCompleted'),

    leaderboardBtn: document.getElementById('leaderboardBtn'),
    leaderboardOverlay: document.getElementById('leaderboardOverlay'),
    leaderboardClose: document.getElementById('leaderboardClose'),
    leaderboardPodium: document.getElementById('leaderboardPodium'),
    leaderboardList: document.getElementById('leaderboardList'),
    leaderboardStatus: document.getElementById('leaderboardStatus'),

    adminFab: document.getElementById('adminFab'),
    adminOverlay: document.getElementById('adminOverlay'),
    adminClose: document.getElementById('adminClose'),
    adminStatus: document.getElementById('adminStatus'),
    adminNameInput: document.getElementById('adminNameInput'),
    adminCreateBtn: document.getElementById('adminCreateBtn'),
    adminTokenOutput: document.getElementById('adminTokenOutput'),

    darkToggle: document.getElementById('darkToggle'),
    themeLabel: document.getElementById('themeLabel'),
    victoryOverlay: document.getElementById('victoryOverlay'),
    victoryParticles: document.getElementById('victoryParticles'),
};

const completeEffects = ['poros', 'poros', 'poros', 'confetti', 'nova', 'spark', 'shards', 'ring'];
const particleColors = ['#facc15', '#38bdf8', '#fb7185', '#22c55e', '#a78bfa', '#fb923c'];

let token = null;
let username = null;
let role = 'player';
let allChamps = [];
let completed = new Set();
let victoryPlayed = false;

init();

async function init() {
    loadTheme();

    UI.tokenSubmitBtn.addEventListener('click', onSubmitToken);
    UI.tokenInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') onSubmitToken();
    });

    UI.search.addEventListener('input', render);
    UI.hideCompleted.addEventListener('change', render);

    UI.leaderboardBtn.addEventListener('click', openLeaderboard);
    UI.leaderboardClose.addEventListener('click', closeLeaderboard);
    UI.leaderboardOverlay.addEventListener('click', (event) => {
        if (event.target === UI.leaderboardOverlay) closeLeaderboard();
    });

    UI.adminFab.addEventListener('click', openAdmin);
    UI.adminClose.addEventListener('click', closeAdmin);
    UI.adminOverlay.addEventListener('click', (event) => {
        if (event.target === UI.adminOverlay) closeAdmin();
    });
    UI.adminCreateBtn.addEventListener('click', createAdminUser);
    UI.adminNameInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') createAdminUser();
    });

    UI.darkToggle.addEventListener('click', toggleTheme);

    const stored = localStorage.getItem('token');
    if (stored) {
        const ok = await validateToken(stored);
        if (ok) {
            token = stored;
            await afterAuthLoad();
            return;
        }
        localStorage.removeItem('token');
    }

    showTokenOverlay();
}

function showTokenOverlay(error = '') {
    UI.tokenOverlay.classList.remove('hidden');
    UI.tokenError.textContent = error;
    UI.tokenInput.value = '';
    UI.tokenInput.focus();
}

async function onSubmitToken() {
    const tokenValue = UI.tokenInput.value.trim();
    if (!tokenValue) {
        UI.tokenError.textContent = 'Please enter a token.';
        return;
    }
    UI.tokenError.textContent = 'Checking token.';
    const ok = await validateToken(tokenValue);
    if (ok) {
        token = tokenValue;
        localStorage.setItem('token', token);
        UI.tokenOverlay.classList.add('hidden');
        await afterAuthLoad();
    } else {
        UI.tokenError.textContent = 'Invalid token. Try again.';
    }
}

async function validateToken(tokenToValidate) {
    try {
        const res = await fetch(`${API_BASE}/api/auth/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: tokenToValidate }),
        });
        if (!res.ok) return false;
        const { user, role: userRole } = await res.json();
        username = user;
        role = userRole || 'player';
        return true;
    } catch {
        return false;
    }
}

async function afterAuthLoad() {
    UI.status.textContent = 'Loading champions.';

    const allRes = await fetch(`${API_BASE}/api/all-champs`);
    const allJson = await allRes.json();
    allChamps = (allJson?.champs || []).slice();

    const meRes = await fetch(`${API_BASE}/api/player-champs/${encodeURIComponent(username)}`);
    const meJson = await meRes.json();
    completed = new Set(Array.isArray(meJson?.champs) ? meJson.champs : []);
    victoryPlayed = completed.size === allChamps.length;

    render();
    renderAdminControls();
}

function renderAdminControls() {
    const isAdmin = role === 'admin';
    UI.adminFab.classList.toggle('hidden', !isAdmin);
    if (!isAdmin) closeAdmin();
}

function render() {
    const query = UI.search.value?.trim().toLowerCase() ?? '';
    let list = query ? allChamps.filter((champ) => champ.name.toLowerCase().includes(query)) : allChamps;
    if (UI.hideCompleted.checked) {
        list = list.filter((champ) => !completed.has(champ.name));
    }

    UI.grid.innerHTML = '';
    for (const champ of list) {
        const el = document.createElement('button');
        const isDone = completed.has(champ.name);
        el.type = 'button';
        el.className = 'champ' + (isDone ? ' completed' : '');
        el.setAttribute('aria-label', champ.name);
        el.title = `Click to mark as ${isDone ? 'not completed' : 'completed'}`;

        const img = document.createElement('img');
        img.alt = '';
        img.setAttribute('aria-hidden', 'true');
        img.loading = 'lazy';
        img.src = champ.imageUrl || '';

        const p = document.createElement('span');
        p.textContent = champ.name;

        el.append(img, p);
        el.addEventListener('click', async () => toggleChampion(champ, el));

        UI.grid.appendChild(el);
    }

    updateStatus(list.length);
}

async function toggleChampion(champ, el) {
    const wasComplete = completed.has(champ.name);

    if (wasComplete) {
        completed.delete(champ.name);
        victoryPlayed = false;
    } else {
        completed.add(champ.name);
        playRandomCompleteEffect(el);
    }

    el.classList.toggle('completed', !wasComplete);
    updateStatus();

    await saveCompleted();

    if (!wasComplete && completed.size === allChamps.length && !victoryPlayed) {
        victoryPlayed = true;
        playVictory();
    }

    if (UI.hideCompleted.checked) {
        render();
    }
}

function updateStatus(shownCount) {
    const shown = Number.isFinite(shownCount) ? shownCount : UI.grid.children.length;
    UI.status.textContent = `${shown} shown - ${completed.size}/${allChamps.length} completed`;
}

async function saveCompleted() {
    if (!token) return;
    try {
        await fetch(`${API_BASE}/api/player-champs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token,
            },
            body: JSON.stringify({ champs: Array.from(completed).sort((a, b) => a.localeCompare(b)) }),
        });
    } catch (error) {
        console.warn('Save failed:', error);
    }
}

function playRandomCompleteEffect(el) {
    const effect = completeEffects[Math.floor(Math.random() * completeEffects.length)];
    const rect = el.getBoundingClientRect();
    const burst = document.createElement('div');
    burst.className = `burst burst-${effect}`;
    burst.style.left = `${rect.left + rect.width / 2}px`;
    burst.style.top = `${rect.top + rect.height / 2}px`;

    const count = effect === 'ring' ? 14 : effect === 'poros' ? 11 : 22;
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('i');
        const angle = (360 / count) * i + Math.random() * 18;
        const distance = 42 + Math.random() * 62;
        particle.style.setProperty('--angle', `${angle}deg`);
        particle.style.setProperty('--distance', `${distance}px`);
        particle.style.setProperty('--delay', `${Math.random() * 90}ms`);
        particle.style.setProperty('--particle-color', particleColors[i % particleColors.length]);
        burst.appendChild(particle);
    }

    document.body.appendChild(burst);
    window.setTimeout(() => burst.remove(), 1600);
}

function playVictory() {
    UI.victoryOverlay.classList.remove('hidden');
    UI.victoryOverlay.classList.remove('victory-run');
    UI.victoryParticles.innerHTML = '';
    for (let i = 0; i < 76; i++) {
        const particle = document.createElement('i');
        if (i % 3 === 0) {
            particle.className = 'victory-poro';
        }
        particle.style.setProperty('--x', `${Math.random() * 100}%`);
        particle.style.setProperty('--delay', `${Math.random() * 1200}ms`);
        particle.style.setProperty('--drift', `${Math.random() * 180 - 90}px`);
        particle.style.setProperty('--scale', `${0.65 + Math.random() * 1.55}`);
        UI.victoryParticles.appendChild(particle);
    }
    void UI.victoryOverlay.offsetWidth;
    UI.victoryOverlay.classList.add('victory-run');
    window.setTimeout(() => {
        UI.victoryOverlay.classList.add('hidden');
        UI.victoryParticles.innerHTML = '';
    }, 5200);
}

async function createAdminUser() {
    const name = UI.adminNameInput.value.trim();
    if (!name) {
        UI.adminStatus.textContent = 'Enter a player name.';
        return;
    }

    UI.adminCreateBtn.disabled = true;
    UI.adminStatus.textContent = 'Creating user.';
    UI.adminTokenOutput.classList.add('hidden');
    UI.adminTokenOutput.textContent = '';

    try {
        const res = await fetch(`${API_BASE}/api/admin/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token,
            },
            body: JSON.stringify({ name }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to create user.');

        UI.adminNameInput.value = '';
        UI.adminStatus.textContent = `Created ${json.user.name}. Token is shown once.`;
        UI.adminTokenOutput.textContent = json.token;
        UI.adminTokenOutput.classList.remove('hidden');
    } catch (error) {
        UI.adminStatus.textContent = error.message || 'Failed to create user.';
    } finally {
        UI.adminCreateBtn.disabled = false;
    }
}

function openAdmin() {
    UI.adminOverlay.classList.remove('hidden');
    UI.adminStatus.textContent = 'Create a player token.';
    UI.adminTokenOutput.classList.add('hidden');
    UI.adminTokenOutput.textContent = '';
    UI.adminNameInput.focus();
}

function closeAdmin() {
    UI.adminOverlay.classList.add('hidden');
}

async function openLeaderboard() {
    UI.leaderboardOverlay.classList.remove('hidden');
    UI.leaderboardStatus.textContent = 'Loading.';
    UI.leaderboardPodium.innerHTML = '';
    UI.leaderboardList.innerHTML = '';

    try {
        const res = await fetch(`${API_BASE}/api/leaderboard`);
        const json = await res.json();
        const total = json.total ?? 0;
        const rows = Array.isArray(json.leaderboard) ? json.leaderboard : [];

        renderLeaderboard(rows, total);
        UI.leaderboardStatus.textContent = `${rows.length} players - ${total} champs total`;
    } catch (e) {
        console.error(e);
        UI.leaderboardStatus.textContent = 'Failed to load leaderboard.';
        UI.leaderboardPodium.innerHTML = '';
        UI.leaderboardList.innerHTML = '';
    }
}

function closeLeaderboard() {
    UI.leaderboardOverlay.classList.add('hidden');
}

function renderLeaderboard(rows, total) {
    const podiumOrder = [
        { index: 1, className: 'silver', label: '2' },
        { index: 0, className: 'gold', label: '1' },
        { index: 2, className: 'bronze', label: '3' },
    ];

    UI.leaderboardPodium.innerHTML = podiumOrder
        .map(({ index, className, label }) => {
            const row = rows[index];
            if (!row) return `<div class="podium-slot podium-empty ${className}"></div>`;
            const isCurrent = row.name === username;
            return `
                <article class="podium-slot ${className}${isCurrent ? ' current-player' : ''}" data-rank="${label}">
                    <div class="medal">${label}</div>
                    <strong>${escapeHtml(row.name)}${isCurrent ? ' <span class="you-badge">(you)</span>' : ''}</strong>
                    <span>${row.count}/${total}</span>
                    <small>${row.pct}%</small>
                </article>
            `;
        })
        .join('');

    const rest = rows.slice(3);
    UI.leaderboardList.innerHTML = rest.length
        ? rest
              .map(
                  (row) => {
                      const isCurrent = row.name === username;
                      return `
                    <article class="leaderboard-row${isCurrent ? ' current-player' : ''}">
                        <span class="rank">${row.rank}</span>
                        <strong>${escapeHtml(row.name)}${isCurrent ? ' <span class="you-badge">(you)</span>' : ''}</strong>
                        <span>${row.count}/${total}</span>
                        <span>${row.pct}%</span>
                    </article>
                `;
                  }
              )
              .join('')
        : '<p class="muted leaderboard-empty">No more players yet.</p>';
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return map[char];
    });
}

function toggleTheme() {
    const next = document.body.classList.contains('dark') ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    applyTheme(next);
}

function applyTheme(theme) {
    const isDark = theme === 'auto' ? window.matchMedia('(prefers-color-scheme: dark)').matches : theme === 'dark';
    if (theme === 'auto') {
        document.body.classList.toggle('dark', isDark);
    } else {
        document.body.classList.toggle('dark', isDark);
    }
    UI.themeLabel.textContent = isDark ? 'Dark' : 'Light';
    UI.darkToggle.title = `Switch to ${isDark ? 'light' : 'dark'} mode`;
    UI.darkToggle.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
}

function loadTheme() {
    const saved = localStorage.getItem('theme') || 'auto';
    if (saved === 'auto') {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        mq.onchange = () => applyTheme('auto');
    }
    applyTheme(saved);
}
