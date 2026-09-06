import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '../../src/app.js';
import { openApiSpec } from '../../src/docs/swagger.js';

describe('Swagger Documentation & docs.json API', () => {
  const app = createApp();

  it('should serve /docs.json with valid OpenAPI 3.0.3 specification', async () => {
    const res = await request(app).get('/docs.json');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('application/json');
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.info.title).toBe('Restaurant SaaS Platform API');
    expect(res.body.tags.length).toBeGreaterThanOrEqual(20);
    expect(Object.keys(res.body.paths).length).toBeGreaterThanOrEqual(40);
  });

  it('should also serve /api/v1/docs.json alias', async () => {
    const res = await request(app).get('/api/v1/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
  });

  it('should serve /docs with interactive Swagger UI HTML page and relaxed CSP', async () => {
    const res = await request(app).get('/docs');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('text/html');
    expect(res.text).toContain('SwaggerUIBundle');
    expect(res.text).toContain('/docs.json');
    expect(res.text).toContain('/docs-assets/swagger-ui-bundle.js');
    expect(res.header['content-security-policy']).toContain("'unsafe-inline'");
  });

  it('should serve /docs-assets static files from swagger-ui-dist', async () => {
    const jsRes = await request(app).get('/docs-assets/swagger-ui-bundle.js');
    expect(jsRes.status).toBe(200);

    const cssRes = await request(app).get('/docs-assets/swagger-ui.css');
    expect(cssRes.status).toBe(200);
  });

  it('should serve /api/v1/docs alias', async () => {
    const res = await request(app).get('/api/v1/docs');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('text/html');
  });

  it('should verify docs/docs.json exists on disk and matches valid OpenAPI JSON format', () => {
    const docsPath = path.resolve(__dirname, '../../../docs/docs.json');
    expect(fs.existsSync(docsPath)).toBe(true);

    const raw = fs.readFileSync(docsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed.openapi).toBe('3.0.3');
    expect(parsed.info.title).toBe('Restaurant SaaS Platform API');
    expect(parsed.paths['/api/v1/auth/login']).toBeDefined();
    expect(parsed.paths['/api/v1/tenants']).toBeDefined();
    expect(parsed.paths['/api/v1/menu/catalog']).toBeDefined();
    expect(parsed.paths['/api/v1/orders']).toBeDefined();
  });
});
