import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'http'

// Local API middleware to handle token exchange and Salesforce proxy (mimics Vercel serverless functions)
function localApiMiddleware() {
  return {
    name: 'local-api-middleware',
    configureServer(server: { middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void } }) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        // Handle /api/token - OAuth token exchange
        if (req.url === '/api/token' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
          req.on('end', async () => {
            try {
              const { code, code_verifier, redirect_uri, client_id } = JSON.parse(body);

              const params = new URLSearchParams({
                grant_type: 'authorization_code',
                client_id,
                redirect_uri,
                code,
                code_verifier,
              });

              const sfResponse = await fetch('https://login.salesforce.com/services/oauth2/token', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'Accept': 'application/json',
                },
                body: params.toString(),
              });

              const data = await sfResponse.json();
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = sfResponse.status;
              res.end(JSON.stringify(data));
            } catch (error) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Token exchange failed' }));
            }
          });
          return;
        }

        // Handle /api/salesforce/* - Salesforce API proxy
        if (req.url?.startsWith('/api/salesforce/')) {
          const url = new URL(req.url, 'http://localhost');
          const instanceUrl = url.searchParams.get('instance_url');
          // Extract sf_path from URL path (everything after /api/salesforce)
          const sfPath = req.url.split('?')[0].replace('/api/salesforce', '');
          const authHeader = req.headers.authorization;

          if (!instanceUrl || !sfPath) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing instance_url or sf_path' }));
            return;
          }

          if (!authHeader) {
            res.statusCode = 401;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing Authorization header' }));
            return;
          }

          // Build query string (excluding our params)
          const queryParams = new URLSearchParams();
          url.searchParams.forEach((value, key) => {
            if (key !== 'instance_url' && key !== 'sf_path') {
              queryParams.append(key, value);
            }
          });
          const queryString = queryParams.toString();
          const fullUrl = `${instanceUrl}${sfPath}${queryString ? '?' + queryString : ''}`;

          // Collect body for non-GET requests
          let body = '';
          req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
          req.on('end', async () => {
            try {
              const sfResponse = await fetch(fullUrl, {
                method: req.method || 'GET',
                headers: {
                  'Authorization': authHeader,
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                },
                body: req.method !== 'GET' && req.method !== 'HEAD' && body ? body : undefined,
              });

              // Handle empty responses (e.g., 204 No Content from PATCH)
              const contentLength = sfResponse.headers.get('content-length');
              const hasContent = contentLength && parseInt(contentLength) > 0;

              let data = {};
              if (hasContent || sfResponse.status !== 204) {
                const text = await sfResponse.text();
                if (text) {
                  try {
                    data = JSON.parse(text);
                  } catch {
                    // Response wasn't JSON, that's OK for 2xx status
                    if (!sfResponse.ok) {
                      data = { error: text };
                    }
                  }
                }
              }

              res.setHeader('Content-Type', 'application/json');
              res.statusCode = sfResponse.status;
              res.end(JSON.stringify(data));
            } catch (error) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Proxy request failed', message: String(error) }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), localApiMiddleware()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['@tremor/react'],
          'vendor-charts': ['recharts'],
        }
      }
    },
    chunkSizeWarningLimit: 600
  }
})
