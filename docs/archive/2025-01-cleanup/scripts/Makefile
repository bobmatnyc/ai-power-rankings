# AI Power Rankings - Makefile
# Convenience commands for common development tasks

.PHONY: help
help:
	@echo "AI Power Rankings - Available commands:"
	@echo ""
	@echo "Development:"
	@echo "  make dev              - Start development server"
	@echo "  make build            - Build production version"
	@echo "  make lint             - Run linter"
	@echo "  make format           - Format code"
	@echo ""
	@echo "News Collection:"
	@echo "  make collect-news     - Collect latest AI news (last 7 days)"
	@echo "  make collect-news-3d  - Collect news from last 3 days"
	@echo "  make collect-news-1d  - Collect news from last 24 hours"
	@echo "  make install-news-deps - Install dependencies for news collection"
	@echo ""
	@echo "Data Management:"
	@echo "  make backup-data      - Backup JSON data"
	@echo "  make validate-data    - Validate JSON data integrity"

# Development commands
.PHONY: dev
dev:
	npm run dev

.PHONY: build
build:
	npm run build

.PHONY: lint
lint:
	npm run lint

.PHONY: format
format:
	npm run format

# News collection commands
.PHONY: install-news-deps
install-news-deps:
	@echo "Installing news collection dependencies..."
	pip install -r requirements-news-collection.txt

.PHONY: collect-news
collect-news:
	@echo "Collecting AI news from the last 7 days..."
	python scripts/collect_news.py

.PHONY: collect-news-3d
collect-news-3d:
	@echo "Collecting AI news from the last 3 days..."
	python scripts/collect_news.py --days 3

.PHONY: collect-news-1d
collect-news-1d:
	@echo "Collecting AI news from the last 24 hours..."
	python scripts/collect_news.py --days 1

# Data management commands
.PHONY: backup-data
backup-data:
	tsx scripts/backup-json-data.ts

.PHONY: validate-data
validate-data:
	tsx scripts/validate-json-data.ts