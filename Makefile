SHELL := /bin/bash
COMPOSE := docker compose -f infra/compose/docker-compose.yml --env-file .env

.PHONY: help dev up down logs ps build migrate seed test clean nuke

help:
	@echo "ResumeAI dev commands:"
	@echo "  make dev      - boot the full local stack (web + services + dbs)"
	@echo "  make up       - start dependencies only (postgres, redis, mongo, minio)"
	@echo "  make down     - stop all containers"
	@echo "  make logs     - tail logs"
	@echo "  make ps       - show container status"
	@echo "  make build    - rebuild all service images"
	@echo "  make migrate  - run Prisma migrations against running postgres"
	@echo "  make seed     - load sample data"
	@echo "  make test     - run unit + integration tests"
	@echo "  make clean    - remove generated artifacts (node_modules, .next, dist, __pycache__)"
	@echo "  make nuke     - clean + remove all docker volumes (DESTROYS DATA)"

dev:
	@if [ ! -f .env ]; then cp .env.example .env; echo "Created .env from .env.example"; fi
	$(COMPOSE) up --build -d
	@echo ""
	@echo "Stack is starting. Visit:"
	@echo "  Web:          http://localhost:3000"
	@echo "  Orchestrator: http://localhost:4000/api/docs"
	@echo "  Auth:         http://localhost:4001"
	@echo "  MinIO:        http://localhost:9001 (resumeai / resumeai_dev_secret)"
	@echo "  Mailhog:      http://localhost:8025"
	@echo ""
	@echo "Tail logs:    make logs"

up:
	$(COMPOSE) up -d postgres redis mongo minio mailhog minio-init

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f --tail=200

ps:
	$(COMPOSE) ps

build:
	$(COMPOSE) build

migrate:
	$(COMPOSE) exec orchestrator npx prisma migrate deploy

seed:
	$(COMPOSE) exec orchestrator node dist/scripts/seed.js || true

test:
	npm --prefix services/auth test --silent || true
	npm --prefix services/orchestrator test --silent || true
	$(COMPOSE) exec resume-parser pytest -q || true
	$(COMPOSE) exec jd-parser pytest -q || true
	$(COMPOSE) exec ats-engine pytest -q || true

clean:
	rm -rf node_modules apps/*/node_modules apps/*/.next services/*/node_modules services/*/dist
	find . -name "__pycache__" -type d -prune -exec rm -rf {} +
	find . -name ".pytest_cache" -type d -prune -exec rm -rf {} +

nuke: down
	docker volume rm $$(docker volume ls -q -f name=resumeai) 2>/dev/null || true
