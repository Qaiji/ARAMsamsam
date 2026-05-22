const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

const validUsername = (s) => /^[A-Za-z0-9_-]{1,32}$/.test(s);

async function atomicWriteJson(filePath, data) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tempPath, filePath);
}

function uniqueSortedStrings(values) {
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

class JsonStorage {
    constructor({ usersFile, champsDir }) {
        this.usersFile = usersFile;
        this.champsDir = champsDir;
        this.users = [];
        this.usersByToken = new Map();
        this.usersByName = new Map();
        this.playerChamps = [];
        this.writeQueues = new Map();
    }

    async init() {
        await fs.mkdir(this.champsDir, { recursive: true });
        await this.loadUsers();
        await this.loadChampFiles();
        await this.ensureChampsForAllUsers();
    }

    async loadUsers() {
        try {
            const usersRaw = await fs.readFile(this.usersFile, 'utf8');
            const parsedUsers = JSON.parse(usersRaw);
            this.users = [];
            this.usersByToken.clear();
            this.usersByName.clear();

            for (const user of parsedUsers) {
                if (!user || typeof user !== 'object') continue;
                const name = String(user.name || '').trim();
                const token = String(user.token || '').trim();
                const role = user.role === 'admin' ? 'admin' : 'player';
                if (!validUsername(name) || !token) continue;

                const normalized = { name, token, role };
                this.users.push(normalized);
                this.usersByToken.set(token, normalized);
                this.usersByName.set(name.toLowerCase(), normalized);
            }
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
            await atomicWriteJson(this.usersFile, []);
        }
    }

    async loadChampFiles() {
        this.playerChamps = [];

        try {
            const files = await fs.readdir(this.champsDir);

            for (const file of files) {
                if (!file.endsWith('.json')) continue;

                const username = path.basename(file, '.json');
                if (!validUsername(username)) continue;

                try {
                    const champsRaw = await fs.readFile(path.join(this.champsDir, file), 'utf8');
                    const parsedChamps = JSON.parse(champsRaw);
                    const champs = Array.isArray(parsedChamps) ? parsedChamps.filter((champ) => typeof champ === 'string') : [];
                    this.playerChamps.push({ name: username, champs: uniqueSortedStrings(champs) });
                } catch (error) {
                    console.warn(`Could not parse ${file}:`, error.message);
                }
            }
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }
    }

    async ensureChampsForAllUsers() {
        const existingNames = new Set(this.playerChamps.map((champ) => champ.name.toLowerCase()));

        for (const user of this.users) {
            if (existingNames.has(user.name.toLowerCase())) continue;

            this.playerChamps.push({ name: user.name, champs: [] });
            await atomicWriteJson(this.champFileFor(user.name), []);
            existingNames.add(user.name.toLowerCase());
        }
    }

    findUserByToken(token) {
        return this.usersByToken.get(token);
    }

    listUsers() {
        return this.users.map(({ name, role }) => ({ name, role }));
    }

    getPlayerChamps(name) {
        return this.playerChamps.find((c) => c.name.toLowerCase() === name.toLowerCase())?.champs || [];
    }

    async setPlayerChamps(name, champs) {
        if (!validUsername(name)) throw new Error('Invalid username');
        if (!Array.isArray(champs)) throw new Error('Champs must be an array');

        const normalizedChamps = uniqueSortedStrings(champs);
        for (const champ of normalizedChamps) {
            if (typeof champ !== 'string') throw new Error('Champs must contain only strings');
        }

        return this.enqueueWrite(name, async () => {
            let entry = this.playerChamps.find((champ) => champ.name.toLowerCase() === name.toLowerCase());
            if (!entry) {
                entry = { name, champs: normalizedChamps };
                this.playerChamps.push(entry);
            } else {
                entry.champs = normalizedChamps;
            }

            await atomicWriteJson(this.champFileFor(name), normalizedChamps);
            return normalizedChamps;
        });
    }

    async createUser({ name, role = 'player' }) {
        const username = String(name || '').trim();
        if (!validUsername(username)) throw new Error('Invalid username');
        if (this.usersByName.has(username.toLowerCase())) throw new Error('User already exists');

        const token = crypto.randomBytes(32).toString('base64url');
        const user = { name: username, token, role: role === 'admin' ? 'admin' : 'player' };

        this.users.push(user);
        this.usersByToken.set(token, user);
        this.usersByName.set(username.toLowerCase(), user);

        await atomicWriteJson(this.usersFile, this.users);
        await this.setPlayerChamps(username, []);

        return { name: user.name, token: user.token, role: user.role };
    }

    enqueueWrite(name, task) {
        const key = name.toLowerCase();
        const previous = this.writeQueues.get(key) || Promise.resolve();
        const next = previous.then(task, task);
        this.writeQueues.set(
            key,
            next.finally(() => {
                if (this.writeQueues.get(key) === next) this.writeQueues.delete(key);
            })
        );
        return next;
    }

    champFileFor(name) {
        if (!validUsername(name)) throw new Error('Invalid username');
        return path.join(this.champsDir, `${name}.json`);
    }
}

module.exports = {
    JsonStorage,
    atomicWriteJson,
    validUsername,
};
