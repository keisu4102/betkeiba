
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');
const path = require('path');

const User = require('./src/models/User');
const api = require('./src/routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({
  extended: false,
  limit: '1mb'
}));

/* =========================================================
   SESSION CONFIGURATION
========================================================= */

app.use(session({
  name: 'betkeiba.sid',
  secret: process.env.SESSION_SECRET || 'development-only-change-me',
  resave: false,
  saveUninitialized: false,

  store: process.env.MONGODB_URI
    ? MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions'
      })
    : undefined,

  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

/* =========================================================
   STATIC FILES
========================================================= */

app.use(express.static(
  path.join(__dirname, 'public')
));

/* =========================================================
   LOAD AUTHENTICATED USER
========================================================= */

app.use(async (req, res, next) => {
  try {
    if (req.session?.userId) {
      req.user = await User.findById(
        req.session.userId
      ).select('_id username role active');
    }

    next();
  } catch (e) {
    next(e);
  }
});

/* =========================================================
   AUTHENTICATION MIDDLEWARE
========================================================= */

function requireAuth(req, res, next) {
  if (!req.session.userId || !req.user) {
    return res.status(401).json({
      error: 'Please log in to continue.'
    });
  }

  if (!req.user.active) {
    return res.status(403).json({
      error: 'This account is disabled.'
    });
  }

  next();
}

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    database:
      mongoose.connection.readyState === 1
        ? 'connected'
        : 'disconnected'
  });
});

/* =========================================================
   CHECK CURRENT LOGIN
========================================================= */

app.get('/api/auth/me', (req, res) => {
  res.json({
    user: req.user
      ? {
          id: req.user.id,
          username: req.user.username,
          role: req.user.role
        }
      : null
  });
});

/* =========================================================
   REGISTER
========================================================= */

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const username = String(
      req.body.username || ''
    ).trim();

    const password = String(
      req.body.password || ''
    );

    if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) {
      return res.status(400).json({
        error: 'Username must be 3–30 characters using letters, numbers, dot, dash, or underscore.'
      });
    }

    if (
      password.length < 10 ||
      password.length > 128
    ) {
      return res.status(400).json({
        error: 'Password must be at least 10 characters.'
      });
    }

    const passwordHash = await bcrypt.hash(
      password,
      12
    );

    const user = await User.create({
      username,
      passwordHash,
      role: 'user'
    });

    const Wallet = require('./src/models/Wallet');

    const startingCredits = Number(
      process.env.STARTING_CREDITS || 10000
    );

    await Wallet.create({
      key: String(user._id),
      balance: startingCredits,
      transactions: [{
        type: 'welcome',
        amount: startingCredits,
        balanceAfter: startingCredits,
        note: 'Starting virtual credits'
      }]
    });

    req.session.userId = String(user._id);

    req.session.save(err => {
      if (err) return next(err);

      res.status(201).json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });
    });

  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({
        error: 'That username is already taken.'
      });
    }

    next(e);
  }
});

/* =========================================================
   LOGIN
========================================================= */

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const username = String(
      req.body.username || ''
    ).trim();

    const password = String(
      req.body.password || ''
    );

    const user = await User.findOne({
      username
    });

    if (
      !user ||
      !user.active ||
      !(await bcrypt.compare(
        password,
        user.passwordHash
      ))
    ) {
      return res.status(401).json({
        error: 'Invalid username or password.'
      });
    }

    req.session.regenerate(err => {
      if (err) return next(err);

      req.session.userId = String(user._id);

      req.session.save(err => {
        if (err) return next(err);

        res.json({
          user: {
            id: user.id,
            username: user.username,
            role: user.role
          }
        });
      });
    });

  } catch (e) {
    next(e);
  }
});

/* =========================================================
   LOGOUT
========================================================= */

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('betkeiba.sid');

    res.json({
      message: 'Logged out.'
    });
  });
});

/* =========================================================
   PROTECT API ROUTES
========================================================= */

app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/')) {
    return next();
  }

  requireAuth(req, res, next);
});

app.use('/api', api);

/* =========================================================
   FRONTEND FALLBACK
========================================================= */

app.get('*', (_req, res) => {
  res.sendFile(
    path.join(__dirname, 'public', 'index.html')
  );
});

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use((err, _req, res, _next) => {
  console.error(err);

  res.status(500).json({
    error:
      process.env.NODE_ENV === 'production'
        ? 'Server error. Check application logs.'
        : err.message
  });
});

/* =========================================================
   START SERVER
========================================================= */

async function start() {
  if (!process.env.MONGODB_URI) {
    console.error(
      'MONGODB_URI is required. Set it in your hosting environment.'
    );

    process.exit(1);
  }

  if (
    process.env.NODE_ENV === 'production' &&
    !process.env.SESSION_SECRET
  ) {
    console.error(
      'SESSION_SECRET is required in production.'
    );

    process.exit(1);
  }

  await mongoose.connect(
    process.env.MONGODB_URI
  );

  console.log('MongoDB connected');

  if (
    process.env.ADMIN_USERNAME &&
    process.env.ADMIN_PASSWORD
  ) {
    const username = String(
      process.env.ADMIN_USERNAME
    ).trim();

    const existing = await User.findOne({
      username
    });

    if (!existing) {
      const passwordHash = await bcrypt.hash(
        process.env.ADMIN_PASSWORD,
        12
      );

      const admin = await User.create({
        username,
        passwordHash,
        role: 'admin'
      });

      const Wallet = require('./src/models/Wallet');

      await Wallet.create({
        key: String(admin._id),
        balance: Number(
          process.env.STARTING_CREDITS || 10000
        )
      });

      console.log(
        'Initial administrator account created from environment settings.'
      );

    } else if (existing.role !== 'admin') {
      console.error(
        'ADMIN_USERNAME already belongs to a regular user. Choose a new unused ADMIN_USERNAME; the account was NOT promoted.'
      );
    }

  } else {
    console.warn(
      'ADMIN_USERNAME/ADMIN_PASSWORD not set; configure them in hosting environment to initialize an administrator.'
    );
  }

  app.listen(PORT, () => {
    console.log(
      `Betkeiba listening on ${PORT}`
    );
  });
}

if (require.main === module) {
  start().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = app;
