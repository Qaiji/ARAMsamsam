const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { JsonStorage } = require('../src/server/storage');

async function withStorage(fn) {
    const root = await mkdtemp(path.join(os.tmpdir(), 'aramsamsam-'));
    const usersFile = path.join(root, 'users.json');
    const champsDir = path.join(root, 'champs');

    try {
        await writeFile(usersFile, JSON.stringify([{ name: 'Admin', token: 'admin-token', role: 'admin' }]), 'utf8');
        const storage = new JsonStorage({ usersFile, champsDir });
        await storage.init();
        await fn({ storage, root, usersFile, champsDir });
    } finally {
        await rm(root, { recursive: true, force: true });
    }
}

test('loads users from configured file and validates tokens with roles', async () => {
    await withStorage(async ({ storage }) => {
        const user = storage.findUserByToken('admin-token');

        assert.deepEqual(user, { name: 'Admin', token: 'admin-token', role: 'admin' });
        assert.equal(storage.findUserByToken('missing-token'), undefined);
    });
});

test('admin user creation generates a token and persists an empty progress file', async () => {
    await withStorage(async ({ storage, usersFile, champsDir }) => {
        const created = await storage.createUser({ name: 'RiverPrince' });

        assert.equal(created.name, 'RiverPrince');
        assert.equal(created.role, 'player');
        assert.match(created.token, /^[A-Za-z0-9_-]{32,}$/);

        const users = JSON.parse(await readFile(usersFile, 'utf8'));
        assert.equal(users.length, 2);
        assert.equal(users[1].name, 'RiverPrince');
        assert.equal(users[1].token, created.token);
        assert.equal(users[1].role, 'player');

        const champs = JSON.parse(await readFile(path.join(champsDir, 'RiverPrince.json'), 'utf8'));
        assert.deepEqual(champs, []);
    });
});

test('rejects duplicate and invalid usernames when creating users', async () => {
    await withStorage(async ({ storage }) => {
        await assert.rejects(() => storage.createUser({ name: 'Admin' }), /already exists/);
        await assert.rejects(() => storage.createUser({ name: '../bad' }), /Invalid username/);
    });
});

test('deduplicates and persists player champion progress', async () => {
    await withStorage(async ({ storage, champsDir }) => {
        await storage.createUser({ name: 'Player_1' });
        const saved = await storage.setPlayerChamps('Player_1', ['Ahri', 'Lux', 'Ahri']);

        assert.deepEqual(saved, ['Ahri', 'Lux']);

        const persisted = JSON.parse(await readFile(path.join(champsDir, 'Player_1.json'), 'utf8'));
        assert.deepEqual(persisted, ['Ahri', 'Lux']);
    });
});
