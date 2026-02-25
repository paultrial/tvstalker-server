const express = require('express');
const TvMazeShow = require('../models/TvMazeShow');
const User = require('../models/User');
const FlSeries = require('../models/FlSeries');
const RarBgSeries = require('../models/RarBgSeries');
const { authRequired } = require('../utils/auth');

const router = express.Router();

function normalizeIds(list) {
  return (list || [])
    .map((id) => (typeof id === 'string' ? Number(id) : id))
    .filter((id) => Number.isFinite(id));
}

router.post('/search', async (req, res) => {
  try {
    const { query, country } = req.body || {};
    if (!query) return res.status(400).json({ error: 'Missing query' });

    const qstring = new RegExp(query, 'i');
    const base = { name: { $regex: qstring } };

    let filter = base;
    if (typeof country === 'string' && country.trim()) {
      filter = {
        $and: [
          base,
          {
            $or: [
              { country },
              { 'network.country.name': country },
              { 'webChannel.country.name': country }
            ]
          }
        ]
      };
    }

    const items = await TvMazeShow.find(filter, { _id: 0 })
      .sort({ name: 1 })
      .limit(200)
      .lean();

    return res.json(items);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Search failed' });
  }
});

router.get('/popular-watched', async (req, res) => {
  try {
    const agg = await User.aggregate([
      { $unwind: '$favorites' },
      { $group: { _id: '$favorites', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const ids = agg.map((a) => a._id);
    const shows = await TvMazeShow.find({ id: { $in: ids } }).lean();
    const byId = new Map(shows.map((s) => [s.id, s]));

    const response = agg
      .map((entry) => {
        const show = byId.get(entry._id);
        if (!show) return null;
        return { ...show, count: entry.count };
      })
      .filter(Boolean);

    return res.json(response);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Popular list failed' });
  }
});

router.post('/more-info', async (req, res) => {
  try {
    const showId = Number(req.body?.showId);
    if (!Number.isFinite(showId)) return res.status(400).json({ error: 'Missing showId' });

    const data = await TvMazeShow.findOne({ id: showId }).lean();
    return res.json(data || null);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Lookup failed' });
  }
});

router.post('/fl-for-serie', async (req, res) => {
  try {
    const serie = (req.body?.serie || '').replace(':', '');
    if (!serie) return res.status(400).json({ error: 'Missing serie' });

    const qstring = new RegExp(`^${serie}`, 'i');
    const items = await FlSeries.find({ title: { $regex: qstring } }, { _id: 0 })
      .sort({ time: -1 })
      .limit(100)
      .lean();

    return res.json(items);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Filelist lookup failed' });
  }
});

router.post('/rarbg-for-serie', async (req, res) => {
  try {
    const serie = (req.body?.serie || '').replace(':', '');
    if (!serie) return res.status(400).json({ error: 'Missing serie' });

    const qstring = new RegExp(`^${serie}`, 'i');
    const items = await RarBgSeries.find({ title: { $regex: qstring } }, { _id: 0 })
      .sort({ time: -1 })
      .limit(100)
      .lean();

    return res.json(items);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'RARBG lookup failed' });
  }
});

router.post('/add-to-set', authRequired, async (req, res) => {
  try {
    const id = Number(req.body?.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Missing id' });

    const user = await User.findByIdAndUpdate(
      req.auth.sub,
      { $addToSet: { favorites: id } },
      { new: true }
    );
    return res.json({ ok: Boolean(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Add failed' });
  }
});

router.post('/pull', authRequired, async (req, res) => {
  try {
    const id = Number(req.body?.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Missing id' });

    const user = await User.findByIdAndUpdate(
      req.auth.sub,
      { $pull: { favorites: id } },
      { new: true }
    );
    return res.json({ ok: Boolean(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Remove failed' });
  }
});

router.post('/user-series', authRequired, async (req, res) => {
  try {
    const list = normalizeIds(req.body?.list);
    if (!list.length) return res.json([]);

    const data = await TvMazeShow.find({ id: { $in: list } }).lean();
    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Fetch failed' });
  }
});

router.post('/user-series-more-info', authRequired, async (req, res) => {
  try {
    const list = normalizeIds(req.body?.list);
    if (!list.length) return res.json([]);

    const data = await TvMazeShow.find({ id: { $in: list } }).lean();
    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Fetch failed' });
  }
});

router.post('/filelist', async (req, res) => {
  try {
    const time = Number(req.body?.time);
    if (!Number.isFinite(time)) return res.status(400).json({ error: 'Missing time' });

    const items = await FlSeries.find({ time: { $gt: time } }).lean();
    return res.json(items);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Filelist query failed' });
  }
});

router.post('/rarbg', async (req, res) => {
  try {
    const time = Number(req.body?.time);
    if (!Number.isFinite(time)) return res.status(400).json({ error: 'Missing time' });

    const items = await RarBgSeries.find({ time: { $gt: time } }).lean();
    return res.json(items);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'RARBG query failed' });
  }
});

module.exports = router;
