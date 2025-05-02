import openai
import gradio as gr
from dotenv import load_dotenv
import os

# Load environment variables from .env
load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")


# Chat history
chat_history = []

def process_message(user_message, history):
    global chat_history

    # Reconstruct full conversation context
    conversation_context = ""
    for msg in chat_history:
        if msg['role'] == 'user':
            conversation_context += f"User: {msg['content']}\n"
        elif msg['role'] == 'assistant':
            conversation_context += f"Bot: {msg['content']}\n"
    conversation_context += f"User: {user_message}\n"

    prompt = f"""
You are a movie recommendation chatbot.
Here is the ongoing conversation between you and the user:
{conversation_context}

You suggest movies based on user mood and preferences.
Do not repeat the user's message. Respond naturally like in a real chat.
"""

    try:
        response = openai.ChatCompletion.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a friendly movie recommendation assistant."},
                {"role": "user", "content": prompt}
            ]
        )
        gpt_response = response['choices'][0]['message']['content']
        chat_history.append({"role": "user", "content": user_message})
        chat_history.append({"role": "assistant", "content": gpt_response})
        return gpt_response
    except Exception as e:
        return f"Error: {str(e)}"

def gradio_interface(message):
    return process_message(message, chat_history)

def reset_chat():
    global chat_history
    chat_history = []
    return "New chat started! Ask me for movie recommendations based on your mood or taste 🎬"

# Gradio UI
with gr.Blocks() as demo:
    gr.Markdown("## 🎥 Movie Recommender Chatbot")
    chatbot = gr.Chatbot()
    msg = gr.Textbox(label="Your Message")
    send_btn = gr.Button("Send")
    clear_btn = gr.Button("Start New Chat")

    def chat_logic(user_input, history):
        response = gradio_interface(user_input)
        history = history + [[user_input, response]]
        return history, ""

    send_btn.click(chat_logic, inputs=[msg, chatbot], outputs=[chatbot, msg])
    clear_btn.click(fn=lambda: ([], reset_chat()), outputs=[chatbot])

# Launch app
if __name__ == "__main__":
    demo.launch()
