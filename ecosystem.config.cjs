module.exports = {
    apps: [
        {
            name: 'aramsamsam',
            script: 'server.js',
            instances: 1,
            exec_mode: 'fork',
            max_memory_restart: '256M',
            env_production: {
                NODE_ENV: 'production',
                PORT: 7071,
                USERS_FILE: 'C:\\apps\\aramsamsam\\data\\users.json',
                CHAMPS_DIR: 'C:\\apps\\aramsamsam\\data\\champs',
                FALLBACK_CHAMPS_FILE: 'C:\\apps\\aramsamsam\\data\\champs-cache.json',
                SKIP_DDRAGON: '1',
                CORS_ORIGIN: 'https://aram.skyblock.id',
            },
        },
    ],
};
