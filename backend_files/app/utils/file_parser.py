import os
import tempfile
from pathlib import Path
from pypdf import PdfReader
from docx import Document


def parse_file(filename: str, contents: bytes) -> str:
    """
    Extract text content from an uploaded file (PDF, DOCX, or TXT).
    """
    suffix = Path(filename).suffix.lower()

    print("📄 Detected file suffix:", suffix)
    
    # 1. Save temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
        tmp_file.write(contents)
        tmp_path = tmp_file.name

    # 2. Parse based on file type
    try:
        if suffix == ".pdf":
            with open(tmp_path, "rb") as f:
                reader = PdfReader(f)
                return "\n".join([page.extract_text() or "" for page in reader.pages])

        elif suffix == ".docx":
            doc = Document(tmp_path)
            return "\n".join([para.text for para in doc.paragraphs])

        elif suffix == ".txt":
            with open(tmp_path, "r", encoding="utf-8") as f:
                return f.read()

        else:
            raise ValueError(f"Unsupported file type: {suffix}")

    finally:
        os.remove(tmp_path)
