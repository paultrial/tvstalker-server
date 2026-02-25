require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const helmet = require('helmet');
const session = require('express-session');
const MongoStore = require('connect-mongo');

const authRoutes = require('./routes/auth');
const seriesRoutes = require('./routes/series');
const subtitlesRoutes = require('./routes/subtitles');
const { startRssJobs } = require('./jobs/rssJobs');
const { startTvMazeJob } = require('./jobs/tvmazeJob');

const app = express();

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/Series';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:4200';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change_me';
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'session';

if (!process.env.SESSION_SECRET) {
  console.warn('[warn] SESSION_SECRET is not set. Set it in server/.env for auth to work.');
}

app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true
  })
);

app.use(
  session({
    name: SESSION_COOKIE_NAME,
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGO_URI, collectionName: 'sessions' }),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 14 * 24 * 60 * 60 * 1000
    }
  })
);

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/series', seriesRoutes);
app.use('/api/subtitles', subtitlesRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('[db] connected');

    startRssJobs();
    startTvMazeJob();

    app.listen(PORT, () => {
      console.log(`[server] listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[server] failed to start', err);
    process.exit(1);
  }
}

start();
