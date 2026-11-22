// The hosted demo never scrapes a bank, so it doesn't need Chromium (and the download would bloat the build).
module.exports = { skipDownload: !!process.env.VERCEL || !!process.env.PUPPETEER_SKIP_DOWNLOAD };
