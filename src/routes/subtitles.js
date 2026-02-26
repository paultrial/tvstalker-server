const express = require('express');
const subs = require('opensubtitles-client').api;

async function loginSubtitles() {
  let emittedError = null;
  const onError = (err) => {
    emittedError = err;
  };

  subs.once('error', onError);
  try {
    const token = await subs.login();
    if (emittedError) throw emittedError;
    return token;
  } finally {
    subs.off('error', onError);
  }
}

const router = express.Router();

router.post('/', async (req, res) => {
  let token;
  try {
    const { name, language } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Missing name' });

    token = await loginSubtitles();
    if (!token) return res.status(502).json({ error: 'Subtitle provider unavailable' });

    const results = await subs.searchForTitle(token, language || 'rum', name);
    return res.json(results || []);
  } catch (err) {
    console.error(err);
    if (!token) return res.status(502).json({ error: 'Subtitle provider unavailable' });
    return res.status(500).json({ error: 'Subtitle search failed' });
  } finally {
    if (!token) return;
    try {
      await subs.logout(token);
    } catch (logoutErr) {
      console.warn('[opensubtitles] logout failed', logoutErr);
    }
  }
});

module.exports = router;
