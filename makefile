# Makefile for TestFleet Local Development

# Load environment variables from .env
include .env
export

.PHONY: help dev stop build clean logs status

# Default target
help:
	@echo "TestFleet Development Commands:"
	@echo "  make dev     - Start all services with docker-compose"
	@echo "  make stop    - Stop all services"
	@echo "  make build   - Build and start services"
	@echo "  make clean   - Stop services and remove volumes (data loss!)"
	@echo "  make logs    - View logs from all services"
	@echo "  make status  - Show status of all services"

# Start development environment
dev:
	@echo "Starting TestFleet development environment..."
	@echo "MongoDB: $(MONGODB_URI)"
	@echo "Organization: $(ORGANIZATION_NAME)"
	docker-compose up -d --build
	@echo "TestFleet is running at http://localhost:$(PORT)"
	@echo "View logs with: make logs"

# Build and start services
build:
	@echo "Building and starting TestFleet..."
	docker-compose up -d --build

# Stop services
stop:
	@echo "Stopping TestFleet services..."
	docker-compose down

# Clean everything (removes data)
clean:
	@echo "Cleaning up TestFleet (this will remove all data)..."
	@read -p "Are you sure? (y/N): " confirm && [ "$$confirm" = "y" ]
	docker-compose down -v
	docker system prune -f

# View logs
logs:
	@echo "Viewing TestFleet logs..."
	docker-compose logs -f

# Show service status
status:
	@echo "TestFleet service status:"
	docker-compose ps

# Test MongoDB connection
test-db:
	@echo "Testing MongoDB connection..."
	@docker exec testfleet-mongodb mongosh --eval "db.adminCommand('ping')" --quiet
	@echo "MongoDB is responding to requests"