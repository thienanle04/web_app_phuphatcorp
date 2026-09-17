import http from 'http';
import app from '../app';

describe('Regression: CORS Preflight & Origin validation', () => {
  let server: http.Server;
  let port: number;

  beforeAll((done) => {
    server = app.listen(0, () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        port = address.port;
      }
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  it('should allow preflight requests from dynamic localhost ports (e.g. Flutter Web, Vite)', async () => {
    const res = await fetch(`http://localhost:${port}/api/auth/login`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:53734',
        'Access-Control-Request-Method': 'POST',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:53734');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('should allow preflight requests from 127.0.0.1 with dynamic ports', async () => {
    const res = await fetch(`http://localhost:${port}/api/auth/login`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://127.0.0.1:8080',
        'Access-Control-Request-Method': 'POST',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:8080');
  });

  it('should allow requests from whitelisted production origin', async () => {
    const res = await fetch(`http://localhost:${port}/api/auth/login`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://phuphatcorp.scrapetool.cloud',
        'Access-Control-Request-Method': 'POST',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://phuphatcorp.scrapetool.cloud');
  });

  it('should allow requests with no origin (e.g. Native Mobile App, curl)', async () => {
    const res = await fetch(`http://localhost:${port}/health`);
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('ok');
  });
});
