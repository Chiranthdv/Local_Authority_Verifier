# Docker Quick Start (Dev)

This project is now wired to run all core services with Docker:
- `frontend` (Vite on port `5173`)
- `backend` (Node/Nodemon on port `5001`)
- `mongo` (MongoDB on port `27017`)
- `redis` (Redis on port `6379`)

## 1) Prerequisites

- Install Docker Desktop
- Ensure Docker Desktop is running

## 2) Start Everything

From project root:

```powershell
docker compose up --build
```

Run in detached mode:

```powershell
docker compose up --build -d
```

## 3) Open the App

- Frontend: `http://localhost:5173`
- Backend health/root: `http://localhost:5001/`

## 4) Check Containers

```powershell
docker compose ps
```

Watch logs:

```powershell
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mongo
docker compose logs -f redis
```

## 5) Seed Admin User (Optional)

```powershell
docker compose exec backend npm run seed:admin
```

Default seed values come from backend environment:
- Email: `admin@example.com`
- Password: `admin@12345`

## 6) Stop Everything

```powershell
docker compose down
```

Stop and remove all volumes (wipes DB/cache data):

```powershell
docker compose down -v
```

## 7) Common Fixes

- If ports are busy, stop local Node servers first.
- If app behavior looks stale after dependency changes:
```powershell
docker compose down
docker compose up --build
```
- If you need a clean database/cache:
```powershell
docker compose down -v
docker compose up --build
```
