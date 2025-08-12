#!/usr/bin/env node

import { createServer } from 'https';
import { parse } from 'url';
import next from 'next';
import fs from 'fs';
import path from 'path';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'helperai.dev';
const port = process.env.PORT || 3000;

// Check if SSL certificates exist
const certPath = './certs/helperai_dev.crt';
const keyPath = './certs/helperai_dev.key';

const httpsOptions = {
  key: fs.existsSync(keyPath) ? fs.readFileSync(keyPath) : null,
  cert: fs.existsSync(certPath) ? fs.readFileSync(certPath) : null,
};

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  if (httpsOptions.key && httpsOptions.cert) {
    // Create HTTPS server
    createServer(httpsOptions, async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error occurred handling', req.url, err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    }).listen(port, () => {
      console.log(`> Ready on https://${hostname}:${port}`);
    });
  } else {
    console.log('SSL certificates not found, falling back to HTTP');
    console.log('Run: pnpm ensure-ssl-certificates to generate certificates');
    
    // Fallback to HTTP
    const { createServer: createHttpServer } = await import('http');
    createHttpServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error occurred handling', req.url, err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    }).listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
  }
});