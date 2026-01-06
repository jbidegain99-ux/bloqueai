"""Storage service for MinIO/S3."""

import io
from typing import BinaryIO, Optional
from uuid import uuid4

from minio import Minio
from minio.error import S3Error

from app.core.config import settings


class StorageService:
    """Service for file storage using MinIO/S3."""

    def __init__(self):
        self.client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_use_ssl,
        )
        self.bucket = settings.minio_bucket
        self._ensure_bucket()

    def _ensure_bucket(self) -> None:
        """Ensure the bucket exists."""
        try:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
        except S3Error as e:
            print(f"Error ensuring bucket: {e}")

    def upload_file(
        self,
        file: BinaryIO,
        filename: str,
        content_type: str,
        folder: str = "resumes",
    ) -> str:
        """Upload a file and return the path."""
        # Generate unique filename
        ext = filename.rsplit(".", 1)[-1] if "." in filename else ""
        unique_name = f"{uuid4()}.{ext}" if ext else str(uuid4())
        path = f"{folder}/{unique_name}"

        # Get file size
        file.seek(0, 2)
        size = file.tell()
        file.seek(0)

        # Upload to MinIO
        self.client.put_object(
            self.bucket,
            path,
            file,
            size,
            content_type=content_type,
        )

        return path

    def download_file(self, path: str) -> Optional[bytes]:
        """Download a file and return its content."""
        try:
            response = self.client.get_object(self.bucket, path)
            return response.read()
        except S3Error:
            return None
        finally:
            if "response" in locals():
                response.close()
                response.release_conn()

    def delete_file(self, path: str) -> bool:
        """Delete a file."""
        try:
            self.client.remove_object(self.bucket, path)
            return True
        except S3Error:
            return False

    def get_presigned_url(self, path: str, expires_hours: int = 1) -> Optional[str]:
        """Get a presigned URL for file access."""
        from datetime import timedelta

        try:
            url = self.client.presigned_get_object(
                self.bucket,
                path,
                expires=timedelta(hours=expires_hours),
            )
            return url
        except S3Error:
            return None


# Singleton instance
storage_service = StorageService()
