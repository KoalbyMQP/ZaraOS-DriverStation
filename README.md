# ZaraOS-DriverStation

New driver station for ZaraOS robots.

## Running locally (development)

**Frontend** (driver-station):

```bash
cd driver-station && npm install && npm run dev
```

**Backend:**

```bash
cd backend && npm install && npm run dev
```

Run each in a separate terminal.

## Running with Docker

### Docker Compose (recommended)

Build and run both the backend and frontend in one command. From the repo root:

```bash
docker compose up -d --build
```

- **Frontend:** http://localhost:3000  
- **Backend API:** http://localhost:3001  

The frontend is built with `NEXT_PUBLIC_API_URL=http://localhost:3001`, so the browser talks to the backend on port 3001. Ensure `backend/.env` exists and has the required variables (e.g. `DATABASE_URL`, `JWT_SECRET`, SMTP settings). See backend docs for full env list.

**Useful commands:**

- `docker compose up -d --build` — build images (if needed) and start containers in the background  
- `docker compose down` — stop and remove the containers  
- `docker compose logs -f` — stream logs from both services  

### Individual containers

If you prefer to build and run the backend and frontend separately:

**Backend:**

```bash
docker build -t zara-backend ./backend
docker run -p 3001:3001 --env-file backend/.env -d --name backend zara-backend
```

**Frontend** (driver-station):

```bash
docker build -t zara-frontend --build-arg NEXT_PUBLIC_API_URL=http://localhost:3001 ./driver-station
docker run -p 3000:3000 -d --name frontend zara-frontend
```

Use the same `NEXT_PUBLIC_API_URL` in the build-arg as the URL the browser will use to reach the backend (e.g. `http://localhost:3001` or `http://<host>:3001`).

To stop/remove: `docker stop backend frontend` then `docker rm backend frontend`, or `docker rm -f backend frontend` to force-remove.
