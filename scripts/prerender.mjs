import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

const port = Number(process.env.PRERENDER_PORT || 4179);
const host = '127.0.0.1';

const siteOrigin = 'https://www.showpiece.com.tw';

const isVercel = Boolean(process.env.VERCEL);

const baseRoutes = [
  {
    url: '/',
    output: 'index.html',
  },
  {
    url: '/pbr',
    output: 'pbr/index.html',
  },
  {
    url: '/pbr/wood-floor',
    output: 'pbr/wood-floor/index.html',
  },
  {
    url: '/pbr/tile',
    output: 'pbr/tile/index.html',
  },
  {
    url: '/pbr/stone',
    output: 'pbr/stone/index.html',
  },
  {
    url: '/pbr/wallpaper',
    output: 'pbr/wallpaper/index.html',
  },

  {
    url: '/guide/pbr-materials',
    output: 'guide/pbr-materials/index.html',
  },
  {
    url: '/guide/pbr-for-blender',
    output: 'guide/pbr-for-blender/index.html',
  },
  {
    url: '/guide/pbr-for-d5-render',
    output: 'guide/pbr-for-d5-render/index.html',
  },
  {
    url: '/guide/pbr-for-enscape',
    output: 'guide/pbr-for-enscape/index.html',
  },
  {
    url: '/guide/pbr-for-lumion',
    output: 'guide/pbr-for-lumion/index.html',
  },
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

/*
|--------------------------------------------------------------------------
| Static server
|--------------------------------------------------------------------------
|
| prerender 時不需要另外啟動 vite preview。
|
| 我們直接把 dist/ 當作靜態網站提供給 Chromium。
|
*/

function safeFilePath(urlPath) {
  const decoded = decodeURIComponent(
    urlPath.split('?')[0]
  );

  const normalized = path
    .normalize(decoded)
    .replace(/^(\.\.(\/|\\|$))+/, '');

  return path.join(
    distDir,
    normalized
  );
}

async function serveFile(res, requestedPath) {
  let filePath = requestedPath;

  const stat = await fs.stat(filePath);

  if (stat.isDirectory()) {
    filePath = path.join(
      filePath,
      'index.html'
    );
  }

  const ext = path
    .extname(filePath)
    .toLowerCase();

  res.writeHead(
    200,
    {
      'Content-Type':
        mimeTypes[ext] ||
        'application/octet-stream',

      'Cache-Control': 'no-store',
    }
  );

  createReadStream(filePath).pipe(res);
}

function startServer() {
  return new Promise(
    (resolve, reject) => {

      const server =
        http.createServer(
          async (req, res) => {

            try {
              let filePath =
                safeFilePath(
                  req.url || '/'
                );

              /*
               * 如果 route 對應的實體檔案不存在，
               * fallback 到 dist/index.html，
               * 交給 Vue Router 處理。
               */
              if (!existsSync(filePath)) {
                filePath =
                  path.join(
                    distDir,
                    'index.html'
                  );
              } else {

                const stat =
                  await fs.stat(filePath);

                if (stat.isDirectory()) {

                  const candidate =
                    path.join(
                      filePath,
                      'index.html'
                    );

                  if (
                    existsSync(candidate)
                  ) {
                    filePath =
                      candidate;
                  } else {
                    filePath =
                      path.join(
                        distDir,
                        'index.html'
                      );
                  }
                }
              }

              await serveFile(
                res,
                filePath
              );

            } catch (error) {

              console.error(
                '[prerender server]',
                error
              );

              res.writeHead(
                500,
                {
                  'Content-Type':
                    'text/plain; charset=utf-8',
                }
              );

              res.end(
                String(error)
              );
            }
          }
        );

      server.once(
        'error',
        reject
      );

      server.listen(
        port,
        host,
        () => {

          console.log(
            `[prerender] local server started at http://${host}:${port}`
          );

          resolve(server);
        }
      );
    }
  );
}

/*
|--------------------------------------------------------------------------
| Browser
|--------------------------------------------------------------------------
*/

function findLocalChrome() {
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }

  if (process.platform === 'win32') {

    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',

      process.env.LOCALAPPDATA
        ? path.join(
            process.env.LOCALAPPDATA,
            'Google',
            'Chrome',
            'Application',
            'chrome.exe'
          )
        : null,
    ].filter(Boolean);

    for (const candidate of candidates) {

      if (
        existsSync(candidate)
      ) {
        return candidate;
      }
    }
  }

  if (process.platform === 'darwin') {
    const chrome =
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

    if (existsSync(chrome)) {
      return chrome;
    }
  }

  const linuxCandidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];

  for (
    const candidate
    of linuxCandidates
  ) {

    if (
      existsSync(candidate)
    ) {
      return candidate;
    }
  }

  return null;
}

async function launchBrowser() {

  /*
   * Vercel
   *
   * 不使用 Puppeteer 自帶 Chrome，
   * 改用 @sparticuz/chromium。
   */
  if (isVercel) {

    const executablePath =
      await chromium.executablePath();

    console.log(
      '[prerender] using Vercel Chromium:',
      executablePath
    );

    return puppeteer.launch({
      args: chromium.args,

      defaultViewport:
        chromium.defaultViewport,

      executablePath,

      headless: chromium.headless,
    });
  }

  /*
   * Local
   *
   * 使用電腦已安裝的 Chrome。
   */
  const executablePath =
    findLocalChrome();

  if (!executablePath) {
    throw new Error(
      [
        '找不到本機 Chrome。',
        '',
        '請設定環境變數 CHROME_PATH，',
        '例如 Windows：',
        '',
        'set CHROME_PATH=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      ].join('\n')
    );
  }

  console.log(
    '[prerender] using local Chrome:',
    executablePath
  );

  return puppeteer.launch({
    executablePath,

    headless: true,

    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });
}

/*
|--------------------------------------------------------------------------
| Page readiness
|--------------------------------------------------------------------------
*/

async function waitReady(
  page,
  route
) {

  const url =
    `http://${host}:${port}${route}`;

  await page.goto(
    url,
    {
      waitUntil:
        'domcontentloaded',

      timeout:
        120_000,
    }
  );

  /*
   * 每個 View 在資料與 SEO metadata
   * 都完成後，把：
   *
   * document.documentElement
   *   .dataset.prerenderReady = 'true'
   *
   * 設好。
   */
  await page.waitForFunction(
    () =>
      document.documentElement
        .dataset
        .prerenderReady === 'true',

    {
      timeout:
        120_000,
    }
  );
}

/*
|--------------------------------------------------------------------------
| Route helpers
|--------------------------------------------------------------------------
*/

function routeToOutput(url) {

  const clean =
    decodeURIComponent(
      url.split('?')[0]
    )
      .replace(
        /^\/+|\/+$/g,
        ''
      );

  return clean
    ? `${clean}/index.html`
    : 'index.html';
}

/*
|--------------------------------------------------------------------------
| Discover Product URLs
|--------------------------------------------------------------------------
*/

async function discoverProductRoutes(
  browser
) {

  const page =
    await browser.newPage();

  try {

    await waitReady(
      page,
      '/pbr'
    );

    const hrefs =
      await page.evaluate(
        () => {

          return [
            ...document
              .querySelectorAll(
                'a[href^="/pbr/product/"]'
              )
          ]
            .map(
              (a) =>
                a.getAttribute(
                  'href'
                )
            )
            .filter(Boolean);
        }
      );

    const unique =
      [
        ...new Set(hrefs)
      ].sort();

    console.log(
      `[prerender] discovered ${unique.length} product routes`
    );

    return unique.map(
      (url) => ({
        url,
        output:
          routeToOutput(url),
      })
    );

  } finally {

    await page.close();
  }
}

/*
|--------------------------------------------------------------------------
| Render single route
|--------------------------------------------------------------------------
*/

async function prerenderRoute(
  browser,
  route
) {

  const page =
    await browser.newPage();

  /*
   * 避免不必要資源拖慢 prerender。
   *
   * 注意：
   * 不擋 stylesheet / JS / Supabase request。
   */
  await page.setRequestInterception(
    true
  );

  page.on(
    'request',
    (request) => {

      const type =
        request.resourceType();

      /*
       * SEO HTML 不需要影片、
       * media、font。
       *
       * 圖片仍保留，避免有些 layout
       * 或 JS 依賴圖片 load。
       */
      if (
        type === 'media' ||
        type === 'font'
      ) {

        request.abort();

        return;
      }

      request.continue();
    }
  );

  page.on(
    'console',
    (msg) => {

      if (
        msg.type() === 'error'
      ) {

        console.error(
          `[browser:${route.url}]`,
          msg.text()
        );
      }
    }
  );

  page.on(
    'pageerror',
    (error) => {

      console.error(
        `[pageerror:${route.url}]`,
        error.message
      );
    }
  );

  try {

    console.log(
      `[prerender] http://${host}:${port}${route.url}`
    );

    await waitReady(
      page,
      route.url
    );

    await page.waitForSelector(
      'h1',
      {
        timeout:
          10_000,
      }
    );

    /*
     * SEO validation
     */
    const summary =
      await page.evaluate(
        () => ({

          title:
            document.title,

          description:
            document
              .querySelector(
                'meta[name="description"]'
              )
              ?.getAttribute(
                'content'
              ) || '',

          canonical:
            document
              .querySelector(
                'link[rel="canonical"]'
              )
              ?.getAttribute(
                'href'
              ) || '',

          h1:
            [
              ...document
                .querySelectorAll(
                  'h1'
                )
            ].map(
              (el) =>
                el.textContent
                  ?.trim()
            ),

          bodyTextLength:
            document
              .body
              .innerText
              .length,

          productJsonLd:
            document
              .querySelectorAll(
                'script[data-phase4-jsonld]'
              )
              .length,

          guideJsonLd:
            document
              .querySelectorAll(
                'script[data-phase5-jsonld]'
              )
              .length,
        })
      );

    /*
     * 一頁只允許一個 H1
     */
    if (
      summary.h1.length !== 1
    ) {

      throw new Error(
        `${route.url} 應只有 1 個 H1，目前為 ${summary.h1.length} 個。`
      );
    }

    /*
     * SEO metadata
     */
    if (
      !summary.title ||
      !summary.description ||
      !summary.canonical
    ) {

      throw new Error(
        `${route.url} 缺少 title / description / canonical。`
      );
    }

    /*
     * 商品 schema
     */
    if (
      route.url.startsWith(
        '/pbr/product/'
      ) &&
      summary.productJsonLd < 2
    ) {

      throw new Error(
        `${route.url} 缺少 Product / Breadcrumb JSON-LD。`
      );
    }

    /*
     * Guide schema
     */
    if (
      route.url.startsWith(
        '/guide/'
      ) &&
      summary.guideJsonLd < 2
    ) {

      throw new Error(
        `${route.url} 缺少 TechArticle / Breadcrumb JSON-LD。`
      );
    }

    /*
     * 避免 data-prerender-ready
     * 被存進最終 HTML。
     */
    await page.evaluate(
      () => {

        document
          .documentElement
          .removeAttribute(
            'data-prerender-ready'
          );
      }
    );

    const html =
      await page.content();

    const outputPath =
      path.join(
        distDir,
        route.output
      );

    await fs.mkdir(
      path.dirname(
        outputPath
      ),
      {
        recursive: true,
      }
    );

    await fs.writeFile(
      outputPath,
      html,
      'utf8'
    );

    console.log(
      `[prerender] wrote ${route.output}`
    );

  } finally {

    await page.close();
  }
}

/*
|--------------------------------------------------------------------------
| Sitemap
|--------------------------------------------------------------------------
*/

function escapeXml(value) {

  return String(value)

    .replace(
      /&/g,
      '&amp;'
    )

    .replace(
      /</g,
      '&lt;'
    )

    .replace(
      />/g,
      '&gt;'
    )

    .replace(
      /"/g,
      '&quot;'
    )

    .replace(
      /'/g,
      '&apos;'
    );
}

async function writeSitemap(
  routes
) {

  const urls =
    [
      ...new Set(
        routes.map(
          (route) => {

            if (
              route.url === '/'
            ) {

              return `${siteOrigin}/`;
            }

            return (
              siteOrigin +
              route.url
            );
          }
        )
      )
    ];

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +

    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +

    urls
      .map(
        (url) =>
          `  <url><loc>${escapeXml(url)}</loc></url>`
      )
      .join('\n') +

    `\n</urlset>\n`;

  await fs.writeFile(
    path.join(
      distDir,
      'sitemap.xml'
    ),
    xml,
    'utf8'
  );

  console.log(
    `[prerender] sitemap.xml updated with ${urls.length} URLs`
  );
}

/*
|--------------------------------------------------------------------------
| Cleanup
|--------------------------------------------------------------------------
*/

async function closeBrowser(
  browser
) {

  if (!browser) {
    return;
  }

  try {

    console.log(
      '[prerender] closing browser...'
    );

    await Promise.race([
      browser.close(),

      new Promise(
        (_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  'browser.close timeout'
                )
              ),
            5000
          )
      ),
    ]);

  } catch (error) {

    console.warn(
      '[prerender] browser close warning:',
      error.message
    );

    /*
     * 如果 Chrome 沒有正常退出，
     * 強制 kill Puppeteer process。
     */
    try {

      browser
        .process()
        ?.kill(
          'SIGKILL'
        );

    } catch {
      // ignore
    }
  }
}

async function closeServer(
  server
) {

  if (!server) {
    return;
  }

  console.log(
    '[prerender] closing local server...'
  );

  await new Promise(
    (resolve) => {

      const timeout =
        setTimeout(
          () => {

            console.warn(
              '[prerender] server close timeout'
            );

            resolve();
          },
          3000
        );

      server.close(
        () => {

          clearTimeout(
            timeout
          );

          resolve();
        }
      );

      /*
       * Node 18+ 可以直接關掉
       * keep-alive connections。
       */
      try {

        server.closeAllConnections?.();

      } catch {
        // ignore
      }
    }
  );
}

/*
|--------------------------------------------------------------------------
| Main
|--------------------------------------------------------------------------
*/

async function main() {

  if (
    !existsSync(
      path.join(
        distDir,
        'index.html'
      )
    )
  ) {

    throw new Error(
      '找不到 dist/index.html。請先執行 vite build。'
    );
  }

  let server;
  let browser;

  try {

    /*
     * Start local static server
     */
    server =
      await startServer();

    /*
     * Start Chromium
     */
    browser =
      await launchBrowser();

    /*
     * 先從 /pbr 真實 DOM
     * 找出目前 Supabase 中的所有商品。
     */
    const productRoutes =
      await discoverProductRoutes(
        browser
      );

    const allRoutes = [
      ...baseRoutes,
      ...productRoutes,
    ];

    /*
     * Sequential render
     *
     * 目前只有約 25 頁，
     * 逐頁 render 比 parallel 更穩定，
     * 且不會一次對 Supabase 發太多 request。
     */
    for (
      const route
      of allRoutes
    ) {

      await prerenderRoute(
        browser,
        route
      );
    }

    /*
     * Sitemap
     */
    await writeSitemap(
      allRoutes
    );

    console.log(
      '[prerender] Phase 5 render complete.'
    );

  } finally {

    /*
     * 一定要先關 Browser，
     * 再關 HTTP server。
     */
    await closeBrowser(
      browser
    );

    await closeServer(
      server
    );
  }

  console.log(
    '[prerender] Phase 5 complete.'
  );
}

/*
|--------------------------------------------------------------------------
| Run
|--------------------------------------------------------------------------
*/

main()
  .then(() => {

    console.log(
      '[prerender] process exiting normally.'
    );

    process.exitCode = 0;
  })

  .catch(
    (error) => {

      console.error(
        '[prerender] fatal error:',
        error
      );

      process.exitCode = 1;
    }
  );