"""Resume parsing job."""

import io
from uuid import UUID

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings


def parse_resume(resume_id: str) -> dict:
    """
    Parse a resume and extract structured data.

    This job:
    1. Downloads the file from MinIO
    2. Extracts text from PDF/DOCX
    3. Uses LLM to extract structured data
    4. Updates the database with results
    """
    from minio import Minio

    # Setup database
    engine = create_engine(settings.database_url)
    Session = sessionmaker(bind=engine)
    db = Session()

    # Setup MinIO
    minio_client = Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_use_ssl,
    )

    try:
        # Import models (lazy import to avoid circular dependencies)
        from datetime import datetime

        # This would import from the API package in production
        # For now, we'll use raw SQL or duplicate the logic

        result = db.execute(
            f"SELECT file_path, file_type, candidate_id FROM resumes WHERE id = '{resume_id}'"
        ).fetchone()

        if not result:
            return {"error": "Resume not found"}

        file_path, file_type, candidate_id = result

        # Download file from MinIO
        response = minio_client.get_object(settings.minio_bucket, file_path)
        content = response.read()
        response.close()
        response.release_conn()

        # Extract text
        if file_type == "pdf":
            import pdfplumber

            text_parts = []
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        text_parts.append(text)
            raw_text = "\n\n".join(text_parts)
        else:
            from docx import Document

            doc = Document(io.BytesIO(content))
            raw_text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())

        # Update status to processing
        db.execute(
            f"UPDATE resumes SET status = 'PROCESSING', raw_text = :text WHERE id = '{resume_id}'",
            {"text": raw_text},
        )
        db.commit()

        # Parse with LLM (or stub)
        parsed_data = _parse_with_llm(raw_text)

        # Update resume and candidate
        import json

        db.execute(
            f"""UPDATE resumes
               SET status = 'COMPLETED',
                   parsed_data = :data,
                   updated_at = :now
               WHERE id = '{resume_id}'""",
            {"data": json.dumps(parsed_data), "now": datetime.utcnow()},
        )

        # Update candidate profile
        if parsed_data.get("skills"):
            db.execute(
                f"""UPDATE candidates
                   SET skills = :skills,
                       updated_at = :now
                   WHERE id = '{candidate_id}'""",
                {"skills": json.dumps(parsed_data["skills"]), "now": datetime.utcnow()},
            )

        db.commit()
        return {"status": "success", "resume_id": resume_id}

    except Exception as e:
        db.execute(
            f"UPDATE resumes SET status = 'FAILED', error_message = :error WHERE id = '{resume_id}'",
            {"error": str(e)},
        )
        db.commit()
        return {"status": "error", "error": str(e)}
    finally:
        db.close()


def _parse_with_llm(text: str) -> dict:
    """Parse CV text with LLM or stub."""
    if settings.use_stub_llm:
        # Deterministic stub response
        import hashlib

        hash_id = hashlib.md5(text.encode()).hexdigest()[:8]
        return {
            "name": f"Candidato {hash_id.upper()}",
            "email": f"candidato.{hash_id}@email.com",
            "phone": "+1234567890",
            "location": "Ciudad de México, México",
            "headline": "Profesional en Tecnología",
            "summary": "Profesional con experiencia en desarrollo de software.",
            "skills": ["Python", "JavaScript", "SQL", "Git", "Agile"],
            "experience": [
                {
                    "title": "Desarrollador",
                    "company": "Tech Company",
                    "start_date": "2020-01",
                    "end_date": "presente",
                }
            ],
            "education": [
                {"degree": "Ingeniería", "institution": "Universidad", "year": "2019"}
            ],
            "languages": [
                {"language": "Español", "level": "Nativo"},
                {"language": "Inglés", "level": "Avanzado"},
            ],
        }
    else:
        import httpx

        # Call LLM API
        response = httpx.post(
            f"{settings.llm_base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.llm_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.llm_model,
                "messages": [
                    {
                        "role": "system",
                        "content": "Extract structured data from CV. Return JSON with: name, email, phone, location, headline, summary, skills, experience, education, languages.",
                    },
                    {"role": "user", "content": text[:8000]},
                ],
                "temperature": 0.3,
            },
            timeout=60.0,
        )
        response.raise_for_status()
        import json

        content = response.json()["choices"][0]["message"]["content"]
        return json.loads(content)
