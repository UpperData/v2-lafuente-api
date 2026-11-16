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
- `/api/banks`: CRUD de bancos; `GET /api/banks?isActived=true|false|*`, `GET /api/banks/:id`, `POST /api/banks`, `PUT /api/banks/:id` y `DELETE /api/banks/:id`. Todos los endpoints requieren cuenta administradora. El cuerpo acepta `name` (obligatorio al crear), `code` (opcional o `null`) e `isActived`; no se puede eliminar un banco que tenga cuentas asociadas.
- `GET /api/bank-accounts?isActived=true|false|*`: lista las cuentas bancarias, incluyendo `bankCode`; `*` devuelve activas e inactivas. Requiere una cuenta administradora.
- `POST /api/auth/login`: inicia sesión; recibe `username` y `password`.
- `POST /api/transactions`: registra una transacción. Requiere autenticación y recibe `amountNeto`, `amountBrute`, `reserveAccountId`, `type` (`input` o `output`), `currencyMoney` (`Dolar` o `Bolivar`) y `payData.method` (`efectivo` para efectivo; los otros métodos se contabilizan como transferencia). `goalId` es opcional; al enviarlo, la transacción se asocia a una meta. El campo opcional `file` se guarda en PostgreSQL `bytea` (Sequelize `BLOB`) y acepta bytea hexadecimal (`\\x...`), Base64, URL `data:` Base64 o un objeto Buffer serializado; máximo 8 MB. Los triggers `update_client_balance` y `update_global_balance` actualizan los saldos de la cuenta y globales dentro de la misma transacción: suman `amountNeto` para `input` y lo restan para `output`. `operatorId` se toma del usuario autenticado. Ejecuta `npm run db:sync` para crear las tablas nuevas; luego aplica `database/update_client_balance.sql` y `database/update_global_balance.sql` en PostgreSQL.
- `GlobalBalance` conserva una fila por moneda con los saldos actuales `currentBalanceCash` y `currentBalanceTransfer`. El trigger independiente de GlobalBalance inicializa cada fila con la suma de los saldos actuales de las cuentas de reserva y actualiza el saldo correspondiente en cada entrada o salida.
- `Goal` registra una meta por cuenta de reserva con monto objetivo, moneda, modalidad (`Efectivo` o `Transferencia`), condición (`Vigente`, `Pausada`, `Cumplida` o `Cancelada`; por defecto `Vigente`) y fecha límite opcional `dateLimit` (`YYYY-MM-DD`). Ejecuta `npm run db:sync` para crear la tabla y la columna opcional `goalId` en transacciones. Si se asocia una meta, deben coincidir la cuenta, moneda y modalidad. Las transacciones `input` suman `amountNeto` a `currentAmount`; las `output` no alteran el progreso.
- `GET /api/goals?reserveAccountId=<id>&isActived=true|false` lista metas; `GET /api/goals/:id` obtiene una. `POST /api/goals` crea una meta y recibe `reserveAccountId`, `targetAmount`, `currencyMoney` y `modality`, con `dateLimit` opcional; `PUT /api/goals/:id` actualiza esos datos. `PATCH /api/goals/:id/activation` recibe `{ "isActived": true|false }` para activarla o desactivarla. Las escrituras requieren cuenta administradora; no existe operación para eliminar metas. Una meta con transacciones asociadas no puede cambiar de cuenta, moneda ni modalidad.
- `GET /api/transactions/:reserveAccountId`: lista transacciones del cliente indicado, con filtros opcionales `type`, `isActived`, `operator` (también acepta `operatorId`), `createdAtFrom` y `createdAtTo` (`YYYY-MM-DD`). Soporta paginación con `page` (por defecto `1`) y `limit` (por defecto `50`, máximo `100`). Requiere autenticación.
- `POST /api/users`: crea un usuario. Requiere `Authorization: Bearer <token>` de una cuenta administradora.

Las respuestas de la API usan `{ "result": "success|warning|error", "message": "", "data": {} }`.
