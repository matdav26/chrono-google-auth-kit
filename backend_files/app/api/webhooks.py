# app/api/webhooks.py

from fastapi import APIRouter, Request, HTTPException
from app.services.summarize import generate_summary
from app.utils.file_parser import parse_file
from app.services.supabase_client import supabase

router = APIRouter()

@router.post("/webhook/document_created")
async def document_created_webhook(request: Request):
    payload = await request.json()
    new_doc = payload.get("record")

    if not new_doc:
        raise HTTPException(status_code=400, detail="Missing document record")

    doc_id = new_doc["id"]
    filename = new_doc["filename"]
    processed = new_doc.get("processed")
    summary = new_doc.get("summary")

    if processed or summary:
        return {"message": "Document already processed or has summary. Skipping."}

    try:
        raw_text = extract_text_from_storage(filename)
        summary_text = generate_summary(raw_text)

        supabase.table("documents").update({
            "summary": summary_text,
            "processed": True
        }).eq("id", doc_id).execute()

        return {"message": f"Summary generated for {filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process document: {e}")
