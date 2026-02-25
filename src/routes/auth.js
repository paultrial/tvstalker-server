const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const { authRequired } = require('../utils/auth');
const { sendPasswordReset } = require('../utils/mailer');

const router = express.Router();

function sanitizeUser(user) {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.passwordHash;
  delete obj.resetToken;
  delete obj.resetTokenExpiresAt;
  return obj;
}

router.post('/signup', async (req, res) => {
  try {
    const { username, email, password, FLpasskey } = req.body || {};
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existing = await User.findOne({
      $or: [{ username }, { email: email.toLowerCase() }]
    });
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email: email.toLowerCase(),
      passwordHash,
      FLpasskey: FLpasskey || '',
      favorites: []
    });

    req.session.userId = user._id.toString();
    req.session.username = user.username;

    return res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Signup failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Missing username or password' });
    }

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.userId = user._id.toString();
    req.session.username = user.username;

    return res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', (req, res) => {
  req.session?.destroy(() => {
    res.clearCookie(process.env.SESSION_COOKIE_NAME || 'session');
    return res.json({ ok: true });
  });
});

router.get('/me', authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.auth.sub);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load user' });
  }
});

router.post('/pass-recover', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Missing email' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.json({ ok: false });

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    user.resetToken = token;
    user.resetTokenExpiresAt = expiresAt;
    await user.save();

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const link = `${baseUrl}/pass-replace/${token}/${encodeURIComponent(user.email)}`;

    await sendPasswordReset({ to: user.email, username: user.username, link });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Password recovery failed' });
  }
});

router.post('/pass-replace', async (req, res) => {
  try {
    const { token, email } = req.body || {};
    if (!token || !email) return res.status(400).json({ error: 'Missing token or email' });

    const user = await User.findOne({ email: email.toLowerCase(), resetToken: token });
    if (!user) return res.json({ ok: false });

    if (user.resetTokenExpiresAt && user.resetTokenExpiresAt < new Date()) {
      return res.json({ ok: false, error: 'Token expired' });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Token check failed' });
  }
});

router.post('/new-pass', async (req, res) => {
  try {
    const { token, email, password } = req.body || {};
    if (!token || !email || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const user = await User.findOne({ email: email.toLowerCase(), resetToken: token });
    if (!user) return res.json({ ok: false });

    if (user.resetTokenExpiresAt && user.resetTokenExpiresAt < new Date()) {
      return res.json({ ok: false, error: 'Token expired' });
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetToken = '';
    user.resetTokenExpiresAt = null;
    await user.save();

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Password reset failed' });
  }
});

router.post('/new-passkey', authRequired, async (req, res) => {
  try {
    const { passKey, password } = req.body || {};
    if (!passKey || !password) return res.status(400).json({ error: 'Missing fields' });

    const user = await User.findById(req.auth.sub);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid password' });

    user.FLpasskey = passKey;
    await user.save();

    return res.json({ ok: true, FLpasskey: user.FLpasskey });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Passkey update failed' });
  }
});

module.exports = router;
