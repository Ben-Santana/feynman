import { createApiServer } from './server.js';

// Vercel captures the HTTP server when the entrypoint calls listen().
createApiServer({ hosted: true }).listen(Number(process.env.PORT || 3001));
