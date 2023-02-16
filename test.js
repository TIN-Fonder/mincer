/* eslint-disable no-await-in-loop */
import fs from 'fs/promises';
import setupMincer from './index.js';

(async () => {
  const { mince, close } = await setupMincer();

  const urlsToScrape = [
    'https://tinfonder.se/',
    'https://tinfonder.se/fonder/tin-ny-teknik',
    'https://tinfonder.se/fonder/tin-world-tech',
    'https://tinfonder.se/hallbarhet',
  ];

  for (let i = 0; i < urlsToScrape.length; i += 1) {
    const url = urlsToScrape[i];

    const html = await mince(url);

    // get the title of the page
    const title = html.match(/<title>(.*?)<\/title>/)[1];

    // write the html to a file
    fs.writeFile(`./testdata/output/${title}.html`, html);
  }

  await close();
})();
