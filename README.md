# 📻 Scout Radio

Live radio channel for scouts — React frontend + Node.js backend.

---

## Folder structure

```
scout-radio/
  server.js          ← Node.js backend
  package.json       ← backend dependencies
  uploads/           ← auto-created when audio is uploaded
  client/            ← React frontend
    index.html
    vite.config.js
    package.json
    src/
      main.jsx
      App.jsx
      socket.js
      index.css
      pages/
        Waiting.jsx  ← countdown page
        Radio.jsx    ← radio app
```

---

## Development (run both servers)

### 1. Install backend dependencies
```
cd scout-radio
npm install
```

### 2. Install frontend dependencies
```
cd client
npm install
```

### 3. Start backend (terminal 1)
```
cd scout-radio
node server.js
```

### 4. Start frontend (terminal 2)
```
cd scout-radio/client
npm run dev
```

Open http://localhost:5173 in your browser.

---

## Production build (for deployment)

### Build the React app
```
cd scout-radio/client
npm run build
```

This creates `client/dist/` which the Node server serves automatically.

### Run only the Node server
```
cd scout-radio
node server.js
```

Open http://localhost:3000

---

## Docker (containerized deployment)

### Prerequisites
- Docker and Docker Compose installed

### Build and run
```
docker-compose up --build
```

This will:
- Start a MySQL database
- Build the Node.js app with React frontend
- Serve on http://localhost:3000

### Environment variables
Edit `docker-compose.yml` to change passwords and secrets for production.

---

## Deployment (give to IT team)

- Node.js app, start command: `node server.js`
- Port: `3000`
- Needs WebSocket support (Socket.io)
- Before deploying, run `npm run build` inside the `client/` folder
- Nginx needs WebSocket headers:
  ```
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  ```

---

## Admin password
`scout2024` — change in `server.js` line 10 and `Radio.jsx` line 5.

---

## URLs
- `/` → countdown/waiting page
- `/radio` → the radio app (login required)
- `/radio` with admin checkbox → admin panel
