// Route definitions
const express = require('express');
const { spawn } = require('child_process');
const pool = require('./db');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcrypt');

dotenv.config();
const router = express.Router();


// Utility to wrap async route handlers and catch errors
const asyncHandler = (fn) => (req, res, next) => 
    Promise.resolve(fn(req, res, next)).catch(next);

// Serve EJS templates
router.get('/', (req, res) => {
  res.render('login', { 
    error: req.query.error,
    success: req.query.success 
  });
});

router.get('/watchlist', asyncHandler(async (req, res) => {
  // console.log("hello");
  if (!req.session.user) {
    return res.redirect('/?error=Please login first');
  }

  try {
    const result = await pool.query(
      `SELECT w.watch_id, m.title, w.watch_date, w.notes
       FROM watched_movies w
       JOIN Movies m ON m.movie_id = w.movie_id
       JOIN Users u ON u.user_id = w.user_id
       WHERE u.username = $1
       ORDER BY w.watch_date DESC`,
      [req.session.user.username]
    );
    // console.log(result.rows);
    
    res.render('watchlist', {
      movies: result.rows,
      error: req.query.error,
      success: req.query.success
    });
  } catch (err) {
    console.error(err);
    res.render('watchlist', {
      movies: [],
      error: 'Failed to load watchlist'
    });
  }
}));


router.get('/recommended', asyncHandler(async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/?error=Please login first');
  }

  try {
    const recommendations = await getRecommendations(req.session.user.id); // Changed from username to id
    // console.log("recommendations: ", recommendations);

    // Extract only titles (case-insensitive match)
    const titles = recommendations.map(rec => rec.title);
    if (titles.length === 0) {
      return res.render('recommended', { movies: [], error: null });
    }

    // Fetch genre and rating from Movies table
    const placeholders = titles.map((_, idx) => `$${idx + 1}`).join(', ');
    const query = `SELECT title, genre, vote_average FROM Movies WHERE LOWER(title) IN (${placeholders})`;
    const result = await pool.query(query, titles.map(t => t.toLowerCase()));

    // Create a map of title -> genre + rating
    const movieMap = {};
    result.rows.forEach(row => {
      movieMap[row.title.toLowerCase()] = {
        title: row.title,
        genre: row.genre,
        rating: row.vote_average
      };
    });

    // Prepare final list: enrich with DB data, skip if not found
    const finalMovies = recommendations.map(rec => movieMap[rec.title.toLowerCase()]).filter(Boolean);
    res.render('recommended', {
      movies: finalMovies,
      error: req.query.error
    });
  } catch (err) {
    console.error(err);
    res.render('recommended', {
      movies: [],
      error: 'Failed to load recommendations'
    });
  }
}));

router.get('/add', asyncHandler(async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/?error=Please login first');
  }

  const { title = '', genre = '', min_rating = '' } = req.query;

  let movies = [];
  if (genre || min_rating) {
    const filters = [];
    const values = [];

    if (genre) {
      filters.push(`LOWER(genre) LIKE $${values.length + 1}`);
      values.push(`%${genre.toLowerCase()}%`);
    }

    if (min_rating) {
      filters.push(`vote_average >= $${values.length + 1}`);
      values.push(parseFloat(min_rating));
    }

    const query = `
      SELECT title, genre, vote_average
      FROM Movies
      WHERE ${filters.join(' AND ')}
      ORDER BY vote_average DESC
      LIMIT 50
    `;

    const result = await pool.query(query, values);
    movies = result.rows;
  }

  res.render('add', {
    title,
    genre,
    min_rating,
    movies,
    error: req.query.error,
    success: req.query.success
  });
}));


router.post('/add', express.urlencoded({ extended: true }), asyncHandler(async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/?error=Please login first');
  }

  const { movie_name, watch_date, notes } = req.body;
  const user_id = req.session.user.id;

  if (!movie_name || !watch_date) {
    return res.redirect('/add?error=Movie name and watch date are required');
  }

  try {
    // Step 1: Search Movies table for matching movie title (case-insensitive)
    const movieResult = await pool.query(
      `SELECT movie_id FROM Movies WHERE LOWER(title) = LOWER($1) LIMIT 1`,
      [movie_name]
    );

    if (movieResult.rows.length === 0) {
      return res.redirect('/add?error=Movie not found in database');
    }

    const movie_id = movieResult.rows[0].movie_id;

    // ✅ Step 2: Check if user has already watched this movie
    const alreadyWatched = await pool.query(
      `SELECT 1 FROM watched_movies WHERE user_id = $1 AND movie_id = $2 LIMIT 1`,
      [user_id, movie_id]
    );

    if (alreadyWatched.rows.length > 0) {
      return res.redirect('/add?error=You have already added this movie to your watchlist');
    }
    // console.log("check 1")
    await pool.query(
      `INSERT INTO watched_movies (user_id, movie_id, watch_date, notes)
       VALUES ($1, $2, $3, $4)`,
      [user_id, movie_id, watch_date, notes || null]
    );
    // console.log("check 2")

    res.redirect('/watchlist?success=Movie added successfully');
  } catch (err) {
    console.error(err);
    res.redirect('/add?error=Failed to add movie');
  }
}));


// API Endpoints
router.get('/api/watchlist/:username', asyncHandler(async (req, res) => {
  const username = req.params.username;
  const result = await pool.query(
    `SELECT w.id, m.title, w.watch_date, w.notes
       FROM WatchedMovies w
       JOIN Movies m ON m.movie_id = w.movie_id
       JOIN Users u ON u.user_id = w.user_id
       WHERE u.username = $1
       ORDER BY w.watch_date DESC`,
    [username]
  );
  res.json(result.rows);
}));

router.post('/api/watch', express.json(), asyncHandler(async (req, res) => {
  const { username, title, genre, rating, notes } = req.body;
  
  const user = await pool.query('SELECT user_id FROM Users WHERE username = $1', [username]);
  if (user.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  await pool.query(
    `INSERT INTO watched_movies (user_id, movie_name, genre, rating, notes)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.rows[0].user_id, title, genre, rating, notes]
  );

  res.json({ success: true });
}));

router.get('/api/recommendations/:user_id', asyncHandler(async (req, res) => {
  const user_id = req.params.user_id;
  const python = spawn(process.env.PYTHON_PATH || 'python3', ['backend/recommender.py', user_id]);

  let output = '';
  python.stdout.on('data', (data) => output += data.toString());
  python.stderr.on('data', (data) => console.error('Python error:', data.toString()));

  python.on('close', (code) => {
    if (code !== 0) return res.status(500).json({ error: 'Python script failed' });
    try {
      res.json(JSON.parse(output));
    } catch (err) {
      res.status(500).json({ error: 'Invalid JSON from recommender.py' });
    }
  });
}));


// Authentication Routes
router.post('/api/watchlist/:id', asyncHandler(async (req, res) => {
  // console.log("coming to delete baby...")
  const watchId = req.params.id;

  if (!req.session.user) {
    return res.redirect('/?error=Please login first');
  }

  try {
    await pool.query(
      `DELETE FROM watched_movies WHERE watch_id = $1 AND user_id = $2`,
      [watchId, req.session.user.id]
    );
    res.redirect('/watchlist?success=Movie removed from watchlist');
  } catch (err) {
    console.error(err);
    res.redirect('/watchlist?error=Failed to remove movie');
  }
}));

router.get('/login', (req, res) => {
  res.render('login', {
    error: req.query.error || null,
    success: req.query.success || null
  });
});


router.post('/api/login', express.urlencoded({ extended: true }), asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.redirect('/?error=Username and password are required');
  }
  
  const user = await pool.query('SELECT * FROM Users WHERE username = $1', [username]);
  if (user.rows.length === 0 || !(await bcrypt.compare(password, user.rows[0].password_hash))) {
    return res.redirect('/?error=Invalid credentials');
  }

  req.session.user = {
    id: user.rows[0].user_id,
    username: user.rows[0].username
  };
  res.redirect('/watchlist');
}));

router.get('/api/logout', (req, res) => {
  // console.log("logging out babes....")
  req.session.destroy(err => {
    if (err) {
      console.error(err);
      return res.redirect('/?error=Logout failed');
    }
    res.redirect('/');
  });
});

router.get('/register', (req, res) => {
  res.render('register', {
    error: req.query.error,
    success: req.query.success
  });
});

router.post('/api/register', express.urlencoded({ extended: true }), asyncHandler(async (req, res) => {
  
  const { username, password, email, confirmPassword } = req.body;
  
  
  if (!username || !password || !email || !confirmPassword) {
    return res.redirect('/register?error=All fields are required');
  }

  if (password != confirmPassword){
    return res.redirect('/register?error=Passwords don\'t match');
  }
  
  const userExists = await pool.query('SELECT username FROM Users WHERE username = $1 OR email = $2', [username, email]);
  
  if (userExists.rows.length > 0) {
    return res.redirect('/register?error=Username or email already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  await pool.query(
    'INSERT INTO Users (username, password_hash, email) VALUES ($1, $2, $3)',
    [username, hashedPassword, email]
  );

  res.redirect('/?success=Registration successful. Please login.');
}));

// Helper function for recommendations
async function getRecommendations(user_id) {
  return new Promise((resolve, reject) => {
    const python = spawn(process.env.PYTHON_PATH || 'python3', ['backend/recommender.py', user_id]);
    // console.log("recommendations loading babes.....")
    let output = '';

    python.stdout.on('data', (data) => output += data.toString());
    python.stderr.on('data', (data) => reject(data.toString()));
    python.on('close', (code) => {
      if (code !== 0) return reject('Python script failed');
      try {
        resolve(JSON.parse(output));
      } catch (err) {
        reject('Invalid JSON from recommender.py');
      }
    });
  });
}

// // In-memory storage for conversation history (for demo purposes)
// let userConversations = {};

// Serve chatbot page
// router.get('/chat', (req, res) => {
//   if (!req.session.user) {
//     return res.redirect('/?error=Please login first');
//   }
//   res.render('chatbot');
// });

// router.post('/chat', (req, res) => {
//     const { userId, message } = req.body;

//     if (!userId || !message) {
//         return res.status(400).json({ error: 'User ID and message are required.' });
//     }

//     // If no conversation history exists for the user, initialize it
//     if (!userConversations[userId]) {
//         userConversations[userId] = [];
//     }

//     // Append the user's message to the conversation history
//     userConversations[userId].push({ role: 'user', content: message });

//     // Spawn Python process to run chatbot.py
//     const pythonProcess = spawn('python3', ['backend/chatbot.py', message, JSON.stringify(userConversations[userId])]);

//     // Capture output from the Python script
//     pythonProcess.stdout.on('data', (data) => {
//         const botResponse = data.toString();

//         // console.log("response :- ", botResponse);
        
//         // Append the bot's response to the conversation history
//         userConversations[userId].push({ role: 'assistant', content: botResponse });

//         // Return the bot's response to the frontend
//         res.json({ response: botResponse });
//     });

//     pythonProcess.stderr.on('data', (data) => {
//         console.error(`stderr: ${data}`);
//         res.status(500).json({ error: 'Error occurred while processing the message.' });
//     });

//     pythonProcess.on('exit', (code) => {
//         if (code !== 0) {
//             console.error(`Python process exited with code ${code}`);
//             res.status(500).json({ error: 'Error occurred while processing the message.' });
//         }
//     });
// });

// // Start new chat
// router.post('/chat/new', (req, res) => {
//   const { userId } = req.body;
//   userConversations[userId] = []; // Reset conversation
//   res.json({ status: 'New chat started' });
// });

router.get('/chat', asyncHandler(async (req, res) => {
  if (!req.session.user) return res.redirect('/?error=Please login first');

  const result = await pool.query(
    'SELECT conversation_history FROM Users WHERE user_id = $1',
    [req.session.user.id]
  );

  const history = result.rows[0]?.conversation_history || [];

  // Remove system message for display
  const displayHistory = history.filter(m => m.role !== 'system');

  res.render('chatbot', {
    userId: req.session.user.id,  // ✅ this line fixes the error
    history: displayHistory
  });
}));


router.post('/chat', asyncHandler(async (req, res) => {
  const { userId, message } = req.body;

  if (!userId || !message) {
    return res.status(400).json({ error: 'User ID and message are required.' });
  }

  // Fetch current conversation history from DB
  const result = await pool.query(
    'SELECT conversation_history FROM Users WHERE user_id = $1',
    [userId]
  );

  let conversation = result.rows[0]?.conversation_history || [];

  // Initialize if empty
  if (conversation.length === 0) {
    conversation = [
      {
        role: "system",
        content: "You are CineMate, a witty and friendly AI movie expert. You help users find the perfect movies based on their mood, preferences, or random cravings. Ask clarifying questions if needed and always provide a mix of hits and hidden gems."
      }
    ];
  }

  // Add user's new message
  conversation.push({ role: "user", content: message });

  // Spawn Python process
  const pythonProcess = spawn('python3', ['backend/chatbot.py']);

  let output = '';
  pythonProcess.stdout.on('data', (data) => output += data.toString());
  pythonProcess.stderr.on('data', (data) => console.error('Python error:', data.toString()));

  pythonProcess.stdin.write(JSON.stringify(conversation));
  pythonProcess.stdin.end();

  pythonProcess.on('close', async (code) => {
    if (code !== 0) {
      return res.status(500).json({ error: 'Chatbot script failed.' });
    }

    try {
      const parsed = JSON.parse(output);
      const reply = parsed.reply;

      // console.log("reply: ", reply);
      // Add assistant reply to conversation
      conversation.push({ role: "assistant", content: reply });

      // Update conversation history in DB
      await pool.query(
        'UPDATE Users SET conversation_history = $1 WHERE user_id = $2',
        [JSON.stringify(conversation), userId]
      );

      res.json({ response: reply });
    } catch (err) {
      console.error('JSON parse error:', err);
      res.status(500).json({ error: 'Failed to parse chatbot response.' });
    }
  });
}));

router.post('/chat/new', asyncHandler(async (req, res) => {
  const { userId } = req.body;
  const emptyConversation = [];

  await pool.query(
    'UPDATE Users SET conversation_history = $1 WHERE user_id = $2',
    [JSON.stringify(emptyConversation), userId]
  );

  res.json({ status: 'New chat started' });
}));



module.exports = router;