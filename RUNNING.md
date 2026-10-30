# Nexus API: run frontend and backend separately

## Backend

In terminal 1, from the project root:

```powershell
npm run dev:backend
```

The backend API runs at `http://localhost:5000`. Its `.env` file is in `backend/.env`.

## Frontend

In terminal 2, from the project root:

```powershell
npm run dev:frontend
```

Open `http://localhost:3000`. The frontend serves the pages and forwards `/api` requests to the backend, preserving the login session.

Start the backend first. Both processes must stay running while using the app.

You can also run each package from its own folder with `npm run dev`.
