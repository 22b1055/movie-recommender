import openai
import sys
import json
import os
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

# A function to process user message and conversation history
def process_message( conversation_history):
    # Construct the conversation context
    conversation_context = ""
    for message in conversation_history:
        if message['role'] == 'user':
            conversation_context += f"User: {message['content']}\n"
        elif message['role'] == 'assistant':
            conversation_context += f"Bot: {message['content']}\n"
    
    # conversation_context += f"User: {user_message}\n"

    prompt = f"""
You are a smart movie recommender assistant. Based on the conversation below, please interact with the user and help him/her to identify his/her taste of movie:

{conversation_context}

Guide the user about the taste and genre which drives his/her mood instead of suggesting movie names and ask to search for the recommended genre in our searching tool.
"""

    # Make API call to GPT-4
    response = openai.ChatCompletion.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful movie recommender."},
            {"role": "user", "content": prompt}
        ]
    )

    bot_response = response['choices'][0]['message']['content']
    return bot_response


# Main function to handle user input and return output
if __name__ == "__main__":
    # # Get user message and history from command-line arguments
    # user_message = sys.argv[1]
    # conversation_history = json.loads(sys.argv[2])  # Expect conversation history in JSON format
    
    # # Get the bot's response
    # response = process_message(user_message, conversation_history)
    
    # if response.startswith("User: "):
    #     response = response[len("User: "):]
    # elif response.startswith("Bot: "):
    #     response = response[len("Bot: "):]
    
    # Read entire conversation from stdin
    conversation_json = sys.stdin.read()
    conversation_history = json.loads(conversation_json)

    # Process the conversation with GPT
    response = process_message(conversation_history)
    if response.startswith("User: "):
        response = response[len("User: "):]
    elif response.startswith("Bot: "):
        response = response[len("Bot: "):]

    # Print response to stdout (will be captured by Node.js)
    print(json.dumps({ "reply": response }))
