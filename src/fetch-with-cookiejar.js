import { fetch as jarFetch, CookieJar, Cookie } from 'node-fetch-cookies';
import { readTmpFile } from './tmp-files.js';

const error = (...args) => {
  // eslint-disable-next-line no-console
  console.error('ERROR cookieJar:', ...args);
};

const msg = (...args) => {
  // eslint-disable-next-line no-console
  console.log('cookieJar:', ...args);
};

const defaultParams = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.8',
    'Cache-Control': 'max-age=0',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Sec-GPC': '1',
    'Upgrade-Insecure-Requests': '1',
  },
  referrerPolicy: 'strict-origin-when-cross-origin',
};

// sleep for random amount of MS
const sleep = (min, max) => new Promise((resolve) => {
  const timeout = Math.floor(Math.random() * (max - min + 1) + min);
  setTimeout(resolve, timeout);
});

export default function fetchWithCookieJar() {
  let myCookieJar = new CookieJar();
  let playwrightCookies = new CookieJar(undefined, 'r', []);
  const cookieJars = [myCookieJar, playwrightCookies];
  let lastNumberOfCookies = 0;

  const sync = async () => {
    let cookiesFromDisk;

    try {
      cookiesFromDisk = JSON.parse(await readTmpFile('cookies.json', 'utf8'));
    } catch (e) {
      return;
    }

    if (!Array.isArray(cookiesFromDisk)) {
      error('cookies.json is not an array, skipping');
      return;
    }

    const renamedCookies = cookiesFromDisk.map((cookie) => {
      const {
        name, value, domain, path, expires, secure,
      } = cookie;

      return Cookie.fromObject({
        name,
        value,
        expiry: expires ? new Date(expires) : null,
        domain,
        path,
        secure,
        subdomains: true,
      });
    });

    const numberOfCookies = renamedCookies.length + myCookieJar.cookies.size;

    if (numberOfCookies !== lastNumberOfCookies) {
      msg(`${numberOfCookies} cookies`);
      lastNumberOfCookies = numberOfCookies;
    }

    playwrightCookies = new CookieJar(undefined, 'r', renamedCookies);
  };

  const resetCookieJar = async () => {
    myCookieJar = new CookieJar();
    return sync();
  };

  const fetch = async (url, params) => {
    let myParams = {
      headers: {},
      ...defaultParams,
      ...params,
    };

    if (params && params.headers) {
      myParams = {
        ...defaultParams,
        ...params,
        headers: {
          ...defaultParams.headers,
          ...params.headers,
        },
      };
    }

    await sync();
    const urlObj = (new URL(url));

    await sleep(10, 100);

    // send OPTIONS first
    await jarFetch(cookieJars, url, {
      ...myParams,
      method: 'OPTIONS',
      headers: {
        ...myParams.headers,
        Origin: urlObj.origin,
        'Access-Control-Request-Method': myParams.method || 'GET',
        'Access-Control-Request-Headers': 'content-type',
      },
    });

    await sleep(1, 20);

    return jarFetch(cookieJars, url, {
      ...myParams,
      headers: {
        ...myParams.headers,
        Origin: urlObj.origin,
      },
    });
  };

  return {
    fetch,
    sync,
    resetCookieJar,
  };
}
