const fs = require('fs').promises;

const SITE_TITLE = 'ARAMsamsam';
const DEFAULT_DESCRIPTION = 'ARAMsamsam - Track ARAM champion completions and race your friends.';

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return map[char];
    });
}

function buildLeaderboardDescription({ users, getPlayerChamps, total }) {
    const rows = users
        .map((user) => ({
            name: user.name,
            count: total ? Math.min(getPlayerChamps(user.name).length, total) : getPlayerChamps(user.name).length,
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, 3);

    if (!rows.length || !total) return DEFAULT_DESCRIPTION;

    const medals = ['🥇', '🥈', '🥉'];
    const leaders = rows.map((row, index) => `${medals[index]} ${row.name} ${row.count}/${total}`).join(' • ');
    return `${SITE_TITLE} | ${leaders}`;
}

function buildMetaTags({ description, siteUrl = 'https://aram.skyblock.id', imageUrl = '/assets/icons/social-preview.png' }) {
    const safeTitle = escapeHtml(SITE_TITLE);
    const safeDescription = escapeHtml(description || DEFAULT_DESCRIPTION);
    const safeSiteUrl = escapeHtml(siteUrl);
    const safeImageUrl = escapeHtml(imageUrl.startsWith('http') ? imageUrl : `${siteUrl}${imageUrl}`);

    return [
        `<title>${safeTitle}</title>`,
        `<meta name="description" content="${safeDescription}" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:title" content="${safeTitle}" />`,
        `<meta property="og:description" content="${safeDescription}" />`,
        `<meta property="og:url" content="${safeSiteUrl}" />`,
        `<meta property="og:image" content="${safeImageUrl}" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:title" content="${safeTitle}" />`,
        `<meta name="twitter:description" content="${safeDescription}" />`,
        `<meta name="twitter:image" content="${safeImageUrl}" />`,
        `<link rel="icon" href="/assets/icons/favicon.ico" sizes="any" />`,
        `<link rel="icon" type="image/png" href="/assets/icons/favicon-32.png" sizes="32x32" />`,
        `<link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png" />`,
    ].join('\n        ');
}

async function renderHomeHtml({ htmlPath, description, siteUrl }) {
    const html = await fs.readFile(htmlPath, 'utf8');
    const metaTags = buildMetaTags({ description, siteUrl });
    return html.replace(/<title>.*?<\/title>/, metaTags);
}

module.exports = {
    SITE_TITLE,
    DEFAULT_DESCRIPTION,
    buildLeaderboardDescription,
    buildMetaTags,
    renderHomeHtml,
};
