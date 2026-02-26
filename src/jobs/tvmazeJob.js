const schedule = require('node-schedule');
const TvMazeShow = require('../models/TvMazeShow');

async function refreshTvMaze() {
  try {
    let page = 0;
    let all = [];

    while (true) {
      const res = await fetch(`https://api.tvmaze.com/shows?page=${page}`);
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) break;
      all = all.concat(data);
      page += 1;
      if (page % 5 === 0) {
        console.log(`[jobs] tvmaze page ${page} (total ${all.length})`);
      }
    }

    if (!all.length) return;

    await TvMazeShow.deleteMany({});

    const chunkSize = 1000;
    for (let i = 0; i < all.length; i += chunkSize) {
      const chunk = all.slice(i, i + chunkSize);
      await TvMazeShow.insertMany(chunk, { ordered: false });
    }

    console.log('[jobs] tvMaze sync complete');
  } catch (err) {
    console.error('[jobs] tvMaze sync failed', err);
  }
}

function startTvMazeJob() {
  if (process.env.DISABLE_JOBS === 'true') return;
  const cron = process.env.TVMAZE_CRON || '0 3 * * 1';
  schedule.scheduleJob(cron, refreshTvMaze);
  if (process.env.TVMAZE_RUN_ON_START === 'true') {
    refreshTvMaze();
  }
}

module.exports = { startTvMazeJob };
