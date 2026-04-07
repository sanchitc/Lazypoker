# LazyPoker

Play poker with friends — no chips required.

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- npm

## Dev Setup

Install dependencies from the project root:

```bash
npm install
```

## Running in Dev Mode

```bash
npm run dev
```

This starts both the server and client concurrently:

- **Server** — Express + Socket.IO, running via `tsx watch` (auto-restarts on changes)
- **Client** — Vite dev server with HMR

Open your browser to `http://localhost:5173` (Vite default).

### Running them separately

```bash
# Server only
npm run dev:server

# Client only
npm run dev:client
```

## Build & Production

```bash
npm run build   # Compiles client (Vite) and server (tsc)
npm start       # Runs the compiled server from dist/
```

## Type Checking

```bash
npm run typecheck
```
