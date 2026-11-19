#!/usr/bin/env bash
set -e

branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
on_main=0
if [ "$branch" = "main" ]; then
  on_main=1
fi

if [ "$on_main" -eq 1 ]; then
  echo "On main: using the hosted API and the production database. The local database stays stopped."
else
  echo "On ${branch:-this branch}: local database only. This branch does not contact Expo or the production database."
fi

# 1. Prepare environment files first
if [ "$on_main" -eq 0 ] && [ ! -f "server/.env" ] && [ -f "server/.env.example" ]; then
  echo "Copying server environment variables..."
  cp server/.env.example server/.env
fi

# 2. Dependency checks (only install if node_modules is missing)
if [ ! -d "node_modules" ]; then
  echo "Installing root dependencies..."
  npm install
fi

if [ "$on_main" -eq 0 ] && [ ! -d "server/node_modules" ]; then
  echo "Installing server dependencies..."
  (cd server && npm install)
fi

# 3. Feature branches get the local database. main does not.
if [ "$on_main" -eq 0 ]; then
  docker compose up -d
fi

# 4. Cleanup helper: kill background processes when you press Ctrl+C
cleanup() {
  echo -e "\nStopping all services..."
  kill $(jobs -p) 2>/dev/null || true
  if [ "$on_main" -eq 0 ]; then
    docker compose down
  fi
  exit
}
trap cleanup SIGINT SIGTERM

# 5. Start the local API only off main
if [ "$on_main" -eq 0 ]; then
  echo "Starting backend server..."
  (cd server && npm start) &
fi

# 6. Start Metro. Off main this stays offline and uses the local API.
echo "Starting Metro bundler..."
npm start &

# Give the packager a moment to initialize before opening iOS simulator
sleep 3

# 7. Launch iOS (runs in foreground)
echo "Launching iOS simulator..."
npm run ios

# Keep the script alive so Ctrl+C can clean up
wait
