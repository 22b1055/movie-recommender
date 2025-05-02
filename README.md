# Movie Recommender Web App

A full-stack movie recommendation system built using Node.js, Express, PostgreSQL, EJS, and OpenAI's GPT-4o-mini. This interactive platform allows users to register/login, manage a personal movie watchlist, get AI-based movie recommendations, and chat with a friendly movie chatbot named **MovieBot**.

---

## 📁 Directory Structure

```
movie-recommender/
├── backend/
│   ├── chatbot.py           # MovieBot chatbot using GPT-4o-mini
│   ├── recommender.py       # Recommendation engine logic
│   ├── db.js                # Database connection setup
│   ├── routes.js            # Express route definitions
│   └── server.js            # Express server entry point
├── views/
│   ├── 404.ejs              # 404 error page
│   ├── error.ejs            # Generic error display page
│   ├── add.ejs              # Add movie interface with search filters
│   ├── login.ejs            # Login page
│   ├── register.ejs         # User registration page
│   ├── recommended.ejs      # Recommendation page based on watchlist
│   ├── watchlist.ejs        # Displays user's movie watchlist
│   └── chatbot.ejs          # Interactive chatbot interface
├── node_modules/            # Project dependencies
├── .env                     # Environment variables (DB credentials, API key)
├── package.json             # Node.js project config
├── package-lock.json        # Dependency tree lock
├── watched_movies.sql       # SQL DDL file to create database schema
└── README.md                # Project documentation
```

---

## 🚀 Features

- ✅ **User Authentication**
  - Register and login using username, email, and password

- 🎬 **Watchlist Management**
  - Add movies to watchlist by title or by searching with genre and rating filters
  - Automatically prevents duplicate entries
  - View, manage, and delete watchlist items

- 🤖 **MovieBot (AI Chatbot)**
  - Chat with MovieBot for conversational movie recommendations
  - Uses GPT-4o-mini to remember past inputs and provide refined suggestions

- 💡 **Smart Recommendations**
  - View recommended movies based on your watchlist using collaborative logic in `recommender.py`

- 🔍 **Movie Search with Filters**
  - Filter by genre (supports multi-genre space-separated matching)
  - Sort results in descending order of rating

- ⚠️ **Error Handling Pages**
  - Clean error UI for general and 404-specific issues

---

## 🛠️ Setup Instructions

1. **Clone the repository**

```bash
git clone https://github.com/22b1055/movie-recommender.git
cd movie-recommender
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

Create a `.env` file in the root directory with:

```
DB_HOST=your_database_host
DB_PORT=5432
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
SESSION_SECRET=your_session_secret
OPENAI_API_KEY=your_openai_key
```

4. **Create the database schema**

Run the SQL file using psql:

```bash
psql -U your_db_user -d your_db_name -f watched_movies.sql
```

5. **Start the application**

```bash
node backend/server.js
```

6. **Access the app**

```bash
Go to: [http://localhost:3000](http://localhost:3000)
```

---

## 📦 Dependencies

- Express.js
- PostgreSQL
- EJS
- bcrypt
- express-session
- dotenv
- OpenAI API (gpt-4o-mini)

---

## 🧠 AI Integration

- `chatbot.py` uses GPT-4o-mini via OpenAI API to provide personalized conversational movie suggestions
- Maintains ongoing conversation history stored per user in the database

---

## 📌 Notes

- Make sure your PostgreSQL server is running and credentials are correct
- Requires an OpenAI API key for chatbot functionality
- This app uses in-EJS styling; feel free to connect a CSS framework for a more scalable frontend

---

## 🙌 Credits

Made with ❤️ by Parthiv Sen using Node.js, PostgreSQL and GPT-4o-mini.
