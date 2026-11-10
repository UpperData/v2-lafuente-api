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
- `GET /api/bank-accounts?isActived=true|false|*`: lista las cuentas bancarias; `*` devuelve activas e inactivas. Requiere una cuenta administradora.
- `POST /api/auth/login`: inicia sesión; recibe `username` y `password`.
- `POST /api/transactions`: registra una transacción. Requiere autenticación y recibe `amountNeto`, `amountBrute`, `reserveAccountId`, `type` (`input` o `output`), `currencyMoney` (`Dolar` o `Bolivar`) y `payData.method` (`efectivo` para efectivo; los otros métodos se contabilizan como transferencia). El trigger `update_client_balance` actualiza el saldo correspondiente de forma atómica: suma `amountNeto` para `input` y lo resta para `output`. `operatorId` se toma del usuario autenticado. Al cambiar la función de la base de datos, ejecuta `database/update_client_balance.sql` en PostgreSQL.
- `POST /api/users`: crea un usuario. Requiere `Authorization: Bearer <token>` de una cuenta administradora.

Las respuestas de la API usan `{ "result": "success|warning|error", "message": "", "data": {} }`.
