import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const port = Number(process.env.PRERENDER_PORT || 4179);
const host = '127.0.0.1';
const siteOrigin = 'https://www.showpiece.com.tw';

const baseRoutes = [
  { url: '/', output: 'index.html' },
  { url: '/pbr', output: 'pbr/index.html' },
  { url: '/pbr/wood-floor', output: 'pbr/wood-floor/index.html' },
  { url: '/pbr/tile', output: 'pbr/tile/index.html' },
  { url: '/pbr/stone', output: 'pbr/stone/index.html' },
  { url: '/pbr/wallpaper', output: 'pbr/wallpaper/index.html' },
  { url: '/guide/pbr-materials', output: 'guide/pbr-materials/index.html' },
  { url: '/guide/pbr-for-blender', output: 'guide/pbr-for-blender/index.html' },
  { url: '/guide/pbr-for-d5-render', output: 'guide/pbr-for-d5-render/index.html' },
  { url: '/guide/pbr-for-enscape', output: 'guide/pbr-for-enscape/index.html' },
  { url: '/guide/pbr-for-lumion', output: 'guide/pbr-for-lumion/index.html' },
];

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function safeFilePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const normalized = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, '');
  return path.join(distDir, normalized);
}

async function serveFile(res, filePath) {
  const stat = await fs.stat(filePath);
  if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(filePath).pipe(res);
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        let filePath = safeFilePath(req.url || '/');

        if (!existsSync(filePath) || (await fs.stat(filePath)).isDirectory()) {
          const candidate = path.join(filePath, 'index.html');
          if (existsSync(candidate)) filePath = candidate;
          else filePath = path.join(distDir, 'index.html');
        }

        await serveFile(res, filePath);
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(String(error));
      }
    });

    server.once('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}

async function waitReady(page, route) {
  await page.goto(`http://${host}:${port}${route}`, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  });

  await page.waitForFunction(
    () => document.documentElement.dataset.prerenderReady === 'true',
    { timeout: 120_000 },
  );
}

function routeToOutput(url) {
  const clean = decodeURIComponent(url.split('?')[0]).replace(/^\/+|\/+$/g, '');
  return clean ? `${clean}/index.html` : 'index.html';
}

async function discoverProductRoutes(browser) {
  const page = await browser.newPage();
  try {
    await waitReady(page, '/pbr');
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll('a[href^="/pbr/product/"]')]
        .map((a) => a.getAttribute('href'))
        .filter(Boolean)
    );

    const unique = [...new Set(hrefs)].sort();
    console.log(`[prerender] discovered ${unique.length} product routes`);
    return unique.map((url) => ({ url, output: routeToOutput(url) }));
  } finally {
    await page.close();
  }
}

async function prerenderRoute(browser, route) {
  const page = await browser.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error(`[browser:${route.url}]`, msg.text());
  });
  page.on('pageerror', (error) => {
    console.error(`[pageerror:${route.url}]`, error.message);
  });

  console.log(`[prerender] http://${host}:${port}${route.url}`);
  await waitReady(page, route.url);
  await page.waitForSelector('h1', { timeout: 10_000 });

  const summary = await page.evaluate(() => ({
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
    h1: [...document.querySelectorAll('h1')].map((el) => el.textContent?.trim()),
    bodyTextLength: document.body.innerText.length,
    productJsonLd: document.querySelectorAll('script[data-phase4-jsonld]').length,
    guideJsonLd: document.querySelectorAll('script[data-phase5-jsonld]').length,
  }));

  if (summary.h1.length !== 1) {
    throw new Error(`${route.url} 應只有 1 個 H1，目前為 ${summary.h1.length} 個。`);
  }
  if (!summary.title || !summary.description || !summary.canonical) {
    throw new Error(`${route.url} 缺少 title / description / canonical。`);
  }
  if (route.url.startsWith('/pbr/product/') && summary.productJsonLd < 2) {
    throw new Error(`${route.url} 缺少 Product / Breadcrumb JSON-LD。`);
  }
  if (route.url.startsWith('/guide/') && summary.guideJsonLd < 2) {
    throw new Error(`${route.url} 缺少 TechArticle / Breadcrumb JSON-LD。`);
  }

  await page.evaluate(() => {
    document.documentElement.removeAttribute('data-prerender-ready');
  });

  const html = await page.content();
  const outputPath = path.join(distDir, route.output);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, html, 'utf8');

  console.log(`[prerender] wrote ${route.output}`);
  await page.close();
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function writeSitemap(routes) {
  const urls = [...new Set(routes.map((route) => `${siteOrigin}${route.url === '/' ? '/' : route.url}`))];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`)
    .join('\n')}\n</urlset>\n`;

  await fs.writeFile(path.join(distDir, 'sitemap.xml'), xml, 'utf8');
  console.log(`[prerender] sitemap.xml updated with ${urls.length} URLs`);
}

async function main() {
  if (!existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('找不到 dist/index.html。請先執行 vite build。');
  }

  const server = await startServer();
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    // 先從真實 /pbr DOM 找出目前 Supabase 中所有商品 URL。
    const productRoutes = await discoverProductRoutes(browser);
    const allRoutes = [...baseRoutes, ...productRoutes];

    for (const route of allRoutes) {
      await prerenderRoute(browser, route);
    }

    await writeSitemap(allRoutes);
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  console.log('[prerender] Phase 5 complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
