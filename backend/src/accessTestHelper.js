import { Readable } from 'node:stream';

export async function accessCookie(server, { host = 'localhost:5173', origin = 'http://localhost:5173' } = {}) {
  const req = Readable.from([JSON.stringify({ code: '6767' })]);
  Object.assign(req, { method: 'POST', url: '/api/access', headers: { host, origin, 'content-type': 'application/json' } });
  return new Promise((resolve, reject) => {
    const headers = {};
    server.emit('request', req, {
      setHeader(name, value) { headers[name.toLowerCase()] = value; },
      writeHead(status) { this.status = status; },
      end() {
        if (this.status !== 200) return reject(new Error(`Access setup failed: ${this.status}`));
        resolve(headers['set-cookie'].split(';')[0]);
      },
    });
  });
}
