# Welcome to the TestFleet Github!

## For local development:

### Set .env vars
Copy the example environment file and populate with your values:
```bash
cp .env.example .env
# Populate .env with your actual values
```

### Start the development environment
Use the Makefile to start all services:
```bash
make dev
```

This will:
- Start MongoDB with persistent storage
- Build and start the control server container

### Verify everything is working
Check service status:
```bash
make status
```

Test database connection:
```bash
make test-db
```

### View logs
```bash
make logs
```

### Stop services
```bash
make stop
```

### Access the application
- **Control Server**: http://localhost:3000
- **MongoDB**: localhost:27017

### Other useful commands
```bash
make build    # Rebuild and start services
make status   # Check service status
make clean    # Stop and remove all data (destructive!)