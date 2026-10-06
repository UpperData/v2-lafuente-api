# v2-lafuente-api

API REST para LaFuente, construida con Node.js, Express, Sequelize y PostgreSQL.

## Requisitos

- Node.js
- PostgreSQL

## Instalación

```bash
npm install
```

Copia `.env.example` como `.env` y completa las credenciales de PostgreSQL y un secreto seguro para `JWT_SECRET`.

## Ejecución

```bash
npm run dev
```

La API usa `APP_PORT` (por defecto `3000`).

## Rutas

- `GET /health`: estado del servicio.
- `POST /api/auth/login`: inicia sesión; recibe `username` y `password`.
- `POST /api/users`: crea un usuario. Requiere `Authorization: Bearer <token>` de una cuenta administradora.

Las respuestas de la API usan `{ "result": "success|warning|error", "message": "", "data": {} }`.
