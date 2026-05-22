const assert = require('node:assert/strict');
const { mkdtemp, rm, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { buildLeaderboardDescription, buildMetaTags, renderHomeHtml } = require('../src/server/meta');

test('builds a Discord-friendly description with top three players', () => {
    const users = [{ name: 'Jay' }, { name: 'RiverPrince' }, { name: 'Hofi' }, { name: 'Medua' }];
    const scores = new Map([
        ['Jay', ['A', 'B', 'C']],
        ['RiverPrince', ['A', 'B']],
        ['Hofi', ['A']],
        ['Medua', []],
    ]);

    const description = buildLeaderboardDescription({
        users,
        total: 3,
        getPlayerChamps: (name) => scores.get(name) || [],
    });

    assert.equal(description, 'ARAMsamsam | 🥇 Jay 3/3 • 🥈 RiverPrince 2/3 • 🥉 Hofi 1/3');
});

test('caps preview scores at the champion total', () => {
    const description = buildLeaderboardDescription({
        users: [{ name: 'Overflow' }],
        total: 3,
        getPlayerChamps: () => ['A', 'B', 'C', 'D'],
    });

    assert.equal(description, 'ARAMsamsam | 🥇 Overflow 3/3');
});

test('renders title and social meta tags into the home html', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'aramsamsam-meta-'));
    const htmlPath = path.join(root, 'aram.html');

    try {
        await writeFile(
            htmlPath,
            '<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Old Title</title><meta name="viewport" content="width=device-width" /></head><body></body></html>',
            'utf8'
        );

        const html = await renderHomeHtml({
            htmlPath,
            description: 'ARAMsamsam | 🥇 Jay 171/171',
            siteUrl: 'https://aram.skyblock.id',
        });

        assert.match(html, /<title>ARAMsamsam<\/title>/);
        assert.match(html, /<meta property="og:title" content="ARAMsamsam" \/>/);
        assert.match(html, /<meta property="og:description" content="ARAMsamsam \| 🥇 Jay 171\/171" \/>/);
        assert.match(html, /<link rel="apple-touch-icon" href="\/assets\/icons\/apple-touch-icon\.png" \/>/);
        assert.doesNotMatch(html, /Old Title/);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('escapes meta tag content', () => {
    const meta = buildMetaTags({ description: 'ARAMsamsam "top" <players>' });

    assert.match(meta, /content="ARAMsamsam &quot;top&quot; &lt;players&gt;"/);
    assert.match(meta, /https:\/\/aram\.skyblock\.id\/assets\/icons\/social-preview\.png/);
});
