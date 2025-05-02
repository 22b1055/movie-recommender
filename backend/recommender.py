# Python recommendation logic
import pandas as pd
import numpy as np
import psycopg2
import sys
import json
import os
from collections import defaultdict
from datetime import datetime
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

def load_data():
    df = pd.read_csv("backend/movie_dataset.csv")  # Adjust path as needed
    features = ['genres', 'keywords', 'title', 'cast', 'director']
    for feature in features:
        df[feature] = df[feature].fillna('')
    df['combined_features'] = df.apply(lambda row: ' '.join(row[feature] for feature in features), axis=1)
    return df

def get_index_from_title(df, title):
    matches = df[df['title'].str.lower() == title.lower()]
    return matches.index[0] if not matches.empty else None

def get_title_from_index(df, index):
    return df.iloc[index]['title']

def recommend_movies(movie_title, df, cosine_sim):
    movie_index = get_index_from_title(df, movie_title)
    if movie_index is None:
        return []
    similar_movies = list(enumerate(cosine_sim[movie_index]))
    sorted_movies = sorted(similar_movies, key=lambda x: x[1], reverse=True)[:30]
    return [get_title_from_index(df, movie[0]) for movie in sorted_movies]

def weighted_score(watch_date, current_date):
    try:
        days_diff = min(30, (current_date - datetime.strptime(watch_date, "%Y-%m-%d")).days)
    except:
        days_diff = 30
    return 1 / (1 + days_diff)

def fetch_user_watched_movies(user_id):
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD")
        )
        cursor = conn.cursor()
        cursor.execute("""
            SELECT m.title, w.watch_date
            FROM watched_movies w
            JOIN Movies m ON w.movie_id = m.movie_id
            JOIN users u ON u.user_id = w.user_id
            WHERE u.user_id = %s
        """, (user_id,))
        watched = cursor.fetchall()
        cursor.close()
        conn.close()
        # print(f"wathched : {watched}")
        return watched
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
        
def rating(movie_title):
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD")
        )
        cursor = conn.cursor()

        query = "SELECT vote_average FROM movies WHERE LOWER(title) = LOWER(%s) LIMIT 1"
        cursor.execute(query, (movie_title,))
        result = cursor.fetchone()

        cursor.close()
        conn.close()

        if result:
            return float(result[0])
        else:
            return None
    except Exception as e:
        print(f"Error fetching vote_average: {e}")
        return None

def generate_recommendations(user_id):
    df = load_data()
    cv = CountVectorizer()
    count_matrix = cv.fit_transform(df['combined_features'])
    cosine_sim = cosine_similarity(count_matrix)
    watched_movies = fetch_user_watched_movies(user_id)
    current_date = datetime.today()
    suggestion_counter = defaultdict(float)

    for movie_name, watch_date in watched_movies:
        suggestions = recommend_movies(movie_name, df, cosine_sim)
        for suggestion in suggestions:
            if suggestion not in [t[0] for t in watched_movies]:
                suggestion_counter[suggestion] += rating(suggestion)*weighted_score(str(watch_date), current_date)
            else :
                suggestion_counter[suggestion]

    top_50 = sorted(suggestion_counter.items(), key=lambda x: x[1], reverse=True)[:51]
    return [{"title": movie, "score": round(score, 4)} for movie, score in top_50]

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Username not provided"}))
        sys.exit(1)

    user_id = sys.argv[1]
    recommendations = generate_recommendations(user_id)
    print(json.dumps(recommendations))
