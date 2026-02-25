const schedule = require('node-schedule');
const { parseStringPromise } = require('xml2js');
const FlSeries = require('../models/FlSeries');
const RarBgSeries = require('../models/RarBgSeries');

async function fetchRarbg() {
  try {
    const res = await fetch('https://eztvx.to/ezrss.xml');
    const text = await res.text();
    const parsed = await parseStringPromise(text);
    const items = parsed?.rss?.channel?.[0]?.item || [];

    for (const item of items) {
      const title = item.title?.[0]?.split('.').join(' ');
      const webLink = item.link?.[0];
      const pubDate = item.pubDate?.[0];
      if (!title) continue;

      const time = pubDate ? new Date(pubDate).getTime() : Date.now();
      await RarBgSeries.updateOne(
        { title },
        { $setOnInsert: { title, webLink, time } },
        { upsert: true }
      );
    }

    console.log('[jobs] RARBG sync complete');
  } catch (err) {
    console.error('[jobs] RARBG sync failed', err);
  }
}

async function fetchFilelist() {
  const passkey = process.env.FILELIST_PASSKEY;
  const url = process.env.FILELIST_FEED_URL ||
    (passkey ? `https://filelist.io/rss.php?feed=dl&cat=21&passkey=${passkey}` : null);

  if (!url) {
    console.log('[jobs] FILELIST_PASSKEY not set; skipping Filelist sync');
    return;
  }

  try {
    const res = await fetch(url);
    const text = await res.text();
    const parsed = await parseStringPromise(text);
    const items = parsed?.rss?.channel?.[0]?.item || [];

    for (const item of items) {
      const title = item.title?.[0]?.split('.').join(' ');
      const webLink = item.link?.[0];
      const descr = item.description?.[0];
      if (!title) continue;

      const time = Date.now();
      await FlSeries.updateOne(
        { title },
        { $setOnInsert: { title, webLink, descr, time } },
        { upsert: true }
      );
    }

    console.log('[jobs] Filelist sync complete');
  } catch (err) {
    console.error('[jobs] Filelist sync failed', err);
  }
}

function startRssJobs() {
  if (process.env.DISABLE_JOBS === 'true') return;

  const rarbgCron = process.env.RARBG_CRON || '0 */6 * * *';
  const filelistCron = process.env.FILELIST_CRON || '15 */6 * * *';

  schedule.scheduleJob(rarbgCron, fetchRarbg);
  fetchRarbg();

  schedule.scheduleJob(filelistCron, fetchFilelist);
  fetchFilelist();
}

module.exports = { startRssJobs };
