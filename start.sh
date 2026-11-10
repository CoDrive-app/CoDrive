#!/usr/bin/env bash
set -e

echo "Starting local environment..."

# 1. Prepare environment files first
if [ ! -f "server/.env" ] && [ -f "server/.env.example" ]; then
  echo "Copying server environment variables..."
  cp server/.env.example server/.env
fi

# 2. Dependency checks (only install if node_modules is missing)
if [ ! -d "node_modules" ]; then
  echo "Installing root dependencies..."
  npm install
fi

if [ ! -d "server/node_modules" ]; then
  echo "Installing server dependencies..."
  (cd server && npm install)
fi

# 3. Start background infrastructure (Docker runs in detached mode with -d)
docker compose up -d

# 4. Cleanup helper: kill background processes when you press Ctrl+C
cleanup() {
  echo -e "\nStopping all services..."
  kill $(jobs -p) 2>/dev/null || true
  docker compose down
  exit
}
trap cleanup SIGINT SIGTERM

# 5. Start server in the background
echo "Starting backend server..."
(cd server && npm start) &

# 6. Start Metro / Web packager in background if needed
echo "Starting Metro bundler..."
npm start &

# Give the packager a moment to initialize before opening iOS simulator
sleep 3

# 7. Launch iOS (runs in foreground)
echo "Launching iOS simulator..."
npm run ios

# Keep the script alive so Ctrl+C can clean up
wait