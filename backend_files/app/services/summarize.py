import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def generate_summary(raw_text: str) -> str:
    """
    Generate a concise summary of the input document text using OpenAI's GPT model.
    The summary will aim to give a clear idea of what the document is about,
    particularly for project-related context.
    """

    prompt = (
        "You are an assistant that helps summarize project documents. "
        "Given the following content, generate a concise summary of 3–5 sentences "
        "that clearly describes what the document is about. Keep it informative, "
        "skip fluff, and highlight key takeaways or topics if any.\n\n"
        f"Document Content:\n{raw_text}\n\nSummary:"
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=300
        )
        summary = response.choices[0].message.content.strip()
        return summary

    except Exception as e:
        print(f"❌ OpenAI summary generation failed: {e}")
        raise
