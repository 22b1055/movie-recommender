// Express server setup
const express = require('express');
const path = require('path');
const routes = require('./routes');
const dotenv = require('dotenv');
const session = require('express-session');
const ejs = require('ejs');

// Load environment variables
dotenv.config();

// Create an Express application
const app = express();

const methodOverride = require('method-override');
app.use(methodOverride('_method'));
app.use('/public', express.static(path.join(__dirname, 'public')));


// Configure view engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-here',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Make session data available to all views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.error = req.query.error || null;
  res.locals.success = req.query.success || null;
  next();
});

// Use defined routes
app.use('/', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { 
    error: 'Something went wrong!',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { 
    title: 'Page Not Found',
    message: 'The page you are looking for does not exist.'
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  // console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});