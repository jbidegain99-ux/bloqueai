"""RQ Worker for background jobs."""

import redis
from rq import Worker, Queue, Connection

from app.config import settings

# Redis connection
redis_conn = redis.from_url(settings.redis_url)

# Queues to listen to
QUEUES = ["high", "default", "low"]


def run_worker():
    """Run the RQ worker."""
    with Connection(redis_conn):
        queues = [Queue(name) for name in QUEUES]
        worker = Worker(queues)
        worker.work()


if __name__ == "__main__":
    run_worker()
