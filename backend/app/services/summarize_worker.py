import os
from app.services.supabase_client import supabase
from app.services.summarize import generate_summary
from app.utils.file_parser import parse_file
from dotenv import load_dotenv



load_dotenv()

def summarize_unprocessed_documents():
    print("🔍 Fetching unprocessed, non-URL documents...")
    response = (
        supabase.table("documents")
        .select("*")
        .filter("processed", "eq", False)
        .filter("doc_type", "neq", "url")
        .filter("summary", "is", "null")
        .execute()
    )

    if not response.data:
        print("✅ No documents to process.")
        return

    for doc in response.data:
        doc_id = doc["id"]
        filename = doc["filename"]
        project_id = doc.get("project_id")

        if not project_id:
            print(f"⚠️ Missing project_id for {filename}, skipping.")
            continue

        storage_path = f"{project_id}/{filename}"
        print(f"📄 Processing document: {filename} (Path: {storage_path})")

        # 1. Extract raw text from Supabase Storage
        try:
            raw_text = parse_file(storage_path)
        except Exception as e:
            print(f"❌ Failed to extract text for {filename}: {e}")
            continue

        if not raw_text:
            print(f"⚠️ No text extracted for {filename}")
            continue

        # 2. Generate summary using LLM
        try:
            summary = generate_summary(raw_text)
        except Exception as e:
            print(f"❌ Failed to summarize {filename}: {e}")
            continue

        # 3. Update Supabase with summary and mark as processed
        try:
            supabase.table("documents").update({
                "summary": summary,
                "processed": True
            }).eq("id", doc_id).execute()
            print(f"✅ Document summarized and updated: {filename}")
        except Exception as e:
            print(f"❌ Failed to update document {filename}: {e}")

if __name__ == "__main__":
    summarize_unprocessed_documents()
