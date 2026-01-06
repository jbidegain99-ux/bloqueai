.PHONY: help install dev up down logs migrate seed test clean

# Colors
BLUE := \033[34m
GREEN := \033[32m
RESET := \033[0m

help: ## Show this help
	@echo "$(BLUE)TalentOS by Bloque - Available commands:$(RESET)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(RESET) %s\n", $$1, $$2}'

install: ## Install dependencies
	@echo "$(BLUE)Installing dependencies...$(RESET)"
	pnpm install
	cd apps/api && pip install -r requirements.txt
	cd apps/worker && pip install -r requirements.txt

dev: ## Run in development mode (docker-compose)
	docker-compose up -d

up: ## Start all services
	docker-compose up -d
	@echo "$(GREEN)Services started!$(RESET)"
	@echo "  - API: http://localhost:8000"
	@echo "  - Web: http://localhost:3000"
	@echo "  - MinIO: http://localhost:9001"

down: ## Stop all services
	docker-compose down

logs: ## Show logs
	docker-compose logs -f

logs-api: ## Show API logs
	docker-compose logs -f api

logs-web: ## Show Web logs
	docker-compose logs -f web

migrate: ## Run database migrations
	docker-compose exec api alembic upgrade head

migrate-create: ## Create new migration (usage: make migrate-create MSG="migration message")
	docker-compose exec api alembic revision --autogenerate -m "$(MSG)"

seed: ## Seed database with initial data
	docker-compose exec api python -m scripts.seed

shell-api: ## Open shell in API container
	docker-compose exec api bash

shell-db: ## Open PostgreSQL shell
	docker-compose exec postgres psql -U talentos -d talentos

test: ## Run tests
	@echo "$(BLUE)Running API tests...$(RESET)"
	cd apps/api && pytest -v
	@echo "$(BLUE)Running Web tests...$(RESET)"
	cd apps/web && pnpm test

test-api: ## Run API tests only
	docker-compose exec api pytest -v

lint: ## Run linters
	cd apps/web && pnpm lint
	cd apps/api && python -m flake8 app --max-line-length=100

clean: ## Clean up Docker resources
	docker-compose down -v --remove-orphans
	docker system prune -f

rebuild: ## Rebuild all containers
	docker-compose build --no-cache
	docker-compose up -d

# Development helpers
api-dev: ## Run API locally (without Docker)
	cd apps/api && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

web-dev: ## Run Web locally (without Docker)
	cd apps/web && pnpm dev
