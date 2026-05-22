const { init } = require('./src/server');

init().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
