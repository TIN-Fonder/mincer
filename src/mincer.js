import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs/promises';

import fetchWithCookieJar from './fetch-with-cookiejar.js';

const error = (...args) => {
  // eslint-disable-next-line no-console
  console.error('ERROR 🍖❗️:', ...args);
};

const msg = (...args) => {
  // eslint-disable-next-line no-console
  console.log('🍖:', ...args);
};

const { NODE_ENV } = process.env;

const defaultSetupMinceProps = {
  validators: [
    {
      selector: '[property="og:description"]',
      regex: /\sproperty="og:description"\s/i,
    },
  ],
  browserOptions: {
    headless: NODE_ENV === 'production',
  },
  contextOptions: {},
};

export default async function setupMincer(props = defaultSetupMinceProps) {
  const {
    validators,
    browserOptions,
    contextOptions,
  } = props;

  // Add stealth plugin and use defaults (all evasion techniques)
  chromium.use(StealthPlugin());

  const { fetch, resetCookieJar } = fetchWithCookieJar();

  let context;
  let browser;
  let probe = null;

  const successRates = {
    fetch: 0,
    browser: 0,
    'browser-try2': 0,
  };

  const tryFetch = async (url) => {
    try {
      const response = await fetch(url);
      const html = await response.text();

      const matches = validators.map((v) => v.regex.test(html));

      if (matches.includes(true)) {
        return html;
      }

      return null;
    } catch (e) {
      error('Fetch error: ', e);
      return null;
    }
  };

  const tryBrowser = async (url) => {
    if (!browser) {
      browser = await chromium.launch(browserOptions);
    }
    if (!context) {
      context = await browser.newContext(contextOptions);

      try {
        const cookies = await fs.readFile('cookies.json');
        await context.addCookies(JSON.parse(cookies));
      } catch (e) {
        // do nothing
      }
    }

    const page = await context.newPage();

    try {
      await page.goto(url);
      await Promise.all(
        validators.map(
          (v) => page.waitForSelector(v.selector, { timeout: 10000, state: 'attached' }),
        ),
      );
      await page.waitForLoadState('domcontentloaded');

      const cookies = await context.cookies();
      await fs.writeFile('cookies.json', JSON.stringify(cookies));
    } catch (e) {
      return null;
    }

    const html = await page.content();

    await page.close();

    return html;
  };

  const resetContext = async () => {
    msg('BROWSER: reset context');
    if (context) {
      await context.close();
      context = null;
      try {
        await fs.unlink('cookies.json');
      } catch (e2) {
        // do nothing
      }
    }
  };

  const close = async () => {
    if (context) {
      await context.close();
    }
    if (browser) {
      await browser.close();
    }
  };

  const mince = async (url) => {
    let successType = null;

    if (!probe) {
      const urlObj = (new URL(url));
      probe = await tryFetch(urlObj.origin);
      if (probe) {
        msg('PROBE fetch success! 🌡️ ✅', urlObj.origin);
      } else {
        probe = await tryBrowser(urlObj.origin);
        if (probe) {
          msg('PROBE browser success! 🌡️ ✅', urlObj.origin);
        }
      }
    }

    let html;

    if (
      (successRates.fetch + successRates.browser) < 10
      || successRates.fetch > successRates.browser
    ) {
      html = await tryFetch(url);
      successType = 'fetch';
    }

    if (!html) {
      await resetCookieJar();
      html = await tryBrowser(url);
      successType = 'browser';
    }

    // reset the context and try again
    if (!html) {
      await resetCookieJar();
      await resetContext();
      html = await tryBrowser(url);
      successType = 'browser-try2';
    }

    if (!html) {
      successType = null;
      await close();
      throw new Error(`Could not mince URL ${url} even on second try`);
    }

    msg(`${successType} success! 🌐`, url);
    successRates[successType] += 1;

    return html;
  };

  return {
    mince,
    close,
  };
}
