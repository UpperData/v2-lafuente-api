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
- `POST /api/transactions`: registra una transacción. Requiere autenticación y recibe `amountNeto`, `amountBrute`, `reserveAccountId`, `type` (`input` o `output`), `currencyMoney` (`Dolar` o `Bolivar`) y `payData.method` (`efectivo` para efectivo; los otros métodos se contabilizan como transferencia). El campo opcional `file` se guarda en PostgreSQL `bytea` (Sequelize `BLOB`) y acepta bytea hexadecimal (`\\x...`), Base64, URL `data:` Base64 o un objeto Buffer serializado; máximo 8 MB. Los triggers `update_client_balance` y `update_global_balance` actualizan los saldos de la cuenta y globales dentro de la misma transacción: suman `amountNeto` para `input` y lo restan para `output`. `operatorId` se toma del usuario autenticado. Ejecuta `npm run db:sync` para crear la tabla `GlobalBalance`; luego aplica `database/update_client_balance.sql` y `database/update_global_balance.sql` en PostgreSQL.
- `GlobalBalance` conserva una fila por moneda con los saldos actuales `currentBalanceCash` y `currentBalanceTransfer`. El trigger independiente de GlobalBalance inicializa cada fila con la suma de los saldos actuales de las cuentas de reserva y actualiza el saldo correspondiente en cada entrada o salida.
- `GET /api/transactions/:reserveAccountId`: lista transacciones del cliente indicado, con filtros opcionales `type`, `isActived`, `operator` (también acepta `operatorId`), `createdAtFrom` y `createdAtTo` (`YYYY-MM-DD`). Soporta paginación con `page` (por defecto `1`) y `limit` (por defecto `50`, máximo `100`). Requiere autenticación.
- `POST /api/users`: crea un usuario. Requiere `Authorization: Bearer <token>` de una cuenta administradora.

Las respuestas de la API usan `{ "result": "success|warning|error", "message": "", "data": {} }`.
