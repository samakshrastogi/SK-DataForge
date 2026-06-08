# SK DataForge

Compact full-stack workspace for uploading, organizing, searching, previewing, and automating file collections.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Node.js, Express, TypeScript, Mongoose
- Storage: MongoDB metadata, local filesystem files

## Features

- Folder-based uploads for tables, documents, images, media, archives, code, and text files
- File manager with create, rename, move, copy, delete, bulk tag, bulk download, and export
- Metadata and optional content search
- Inline previews for tables, text/code, images, PDFs, audio, and video
- Table insights for missing cells, duplicate rows, column types, fill rates, top values, ranges, and trends
- Duplicate detection by SHA-256 content hash
- Workspace quota, notifications, scheduled imports, and retention rules
- Authentication, role-based access, and audit logging

## Setup

```bash
npm install --prefix backend
npm install --prefix frontend
```

Create `backend/.env` from `backend/.env.example` and `frontend/.env` from `frontend/.env.example`.

Required backend values:

```env
APP_NAME=SK DataForge
APP_URL=http://localhost:5000
API_BASE_PATH=/api
CORS_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB_NAME=sk-dataforge
UPLOAD_ROOT=uploads
AUTH_TOKEN_SECRET=replace-with-a-long-random-secret
ADMIN_EMAIL=admin@sk-dataforge.local
ADMIN_PASSWORD=ChangeMe123!
```

Run locally:

```bash
npm run dev:backend
npm run dev:frontend
```

Build:

```bash
npm run build:backend
npm run build:frontend
```

## Default Access

If the database has no users, the backend creates one admin user from `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

## API Areas

- `/api/auth`
- `/api/dashboard`
- `/api/workspace`
- `/api/uploads`
- `/api/manager`
- `/api/search`
- `/api/automation`
- `/api/notifications`
- `/api/audit`

## Notes

- URL and local-folder imports are executable today.
- Cloud connector types are modeled but not fully implemented.
- Files are stored locally unless a future storage adapter is added.
