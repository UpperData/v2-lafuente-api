BEGIN;

DROP TRIGGER IF EXISTS trg_update_global_balance ON public.transactions;

CREATE OR REPLACE FUNCTION public.ensure_global_balance(p_currency text)
RETURNS void
LANGUAGE plpgsql
COST 100
VOLATILE
PARALLEL UNSAFE
AS $BODY$
BEGIN
  IF p_currency = 'Dolar' THEN
    INSERT INTO public."globalBalances" (
      "currencyMoney",
      "currentBalanceCash",
      "currentBalanceTransfer",
      "createdAt",
      "updatedAt"
    )
    SELECT
      'Dolar',
      COALESCE(SUM("currentBalanceCashUSD"), 0),
      COALESCE(SUM("currentBalanceTransferUSD"), 0),
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    FROM public."reserveAccounts"
    ON CONFLICT ("currencyMoney") DO NOTHING;
  ELSIF p_currency = 'Bolivar' THEN
    INSERT INTO public."globalBalances" (
      "currencyMoney",
      "currentBalanceCash",
      "currentBalanceTransfer",
      "createdAt",
      "updatedAt"
    )
    SELECT
      'Bolivar',
      COALESCE(SUM("currentBalanceCashVES"), 0),
      COALESCE(SUM("currentBalanceTransferVES"), 0),
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    FROM public."reserveAccounts"
    ON CONFLICT ("currencyMoney") DO NOTHING;
  ELSE
    RAISE EXCEPTION 'Moneda no soportada para actualizar el saldo global.'
      USING ERRCODE = '23514';
  END IF;
END;
$BODY$;

ALTER FUNCTION public.ensure_global_balance(text) OWNER TO upperdata;

CREATE OR REPLACE FUNCTION public.adjust_global_balance(
  p_currency text,
  p_amount numeric,
  p_type text,
  p_reverse boolean DEFAULT false,
  p_payment_method text DEFAULT 'Transferencia'
)
RETURNS void
LANGUAGE plpgsql
COST 100
VOLATILE
PARALLEL UNSAFE
AS $BODY$
DECLARE
  v_balance_delta numeric(18, 2);
  v_payment_method text;
BEGIN
  IF p_type NOT IN ('input', 'output')
    OR p_amount IS NULL
    OR p_amount <= 0
    OR p_currency NOT IN ('Dolar', 'Bolivar')
  THEN
    RAISE EXCEPTION 'Datos de transacción inválidos para actualizar el saldo global.'
      USING ERRCODE = '23514';
  END IF;

  v_payment_method := lower(trim(COALESCE(p_payment_method, '')));
  v_balance_delta := CASE
    WHEN p_type = 'input' THEN p_amount
    ELSE -p_amount
  END;

  IF p_reverse THEN
    v_balance_delta := -v_balance_delta;
  END IF;

  PERFORM public.ensure_global_balance(p_currency);

  IF p_currency = 'Dolar' AND v_payment_method = 'efectivo' THEN
    UPDATE public."globalBalances"
    SET "currentBalanceCash" = "currentBalanceCash" + v_balance_delta,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "currencyMoney" = 'Dolar';
  ELSIF p_currency = 'Dolar' THEN
    UPDATE public."globalBalances"
    SET "currentBalanceTransfer" = "currentBalanceTransfer" + v_balance_delta,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "currencyMoney" = 'Dolar';
  ELSIF p_currency = 'Bolivar' AND v_payment_method = 'efectivo' THEN
    UPDATE public."globalBalances"
    SET "currentBalanceCash" = "currentBalanceCash" + v_balance_delta,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "currencyMoney" = 'Bolivar';
  ELSE
    UPDATE public."globalBalances"
    SET "currentBalanceTransfer" = "currentBalanceTransfer" + v_balance_delta,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "currencyMoney" = 'Bolivar';
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No fue posible actualizar el saldo global.'
      USING ERRCODE = '23514';
  END IF;
END;
$BODY$;

ALTER FUNCTION public.adjust_global_balance(
  text, numeric, text, boolean, text
) OWNER TO upperdata;

CREATE OR REPLACE FUNCTION public.update_global_balance()
RETURNS trigger
LANGUAGE plpgsql
COST 100
VOLATILE
AS $BODY$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    PERFORM public.adjust_global_balance(
      OLD."currencyMoney"::text,
      OLD."amountNeto",
      OLD.type::text,
      true,
      COALESCE(OLD."payData"->>'method', 'Transferencia')
    );
  END IF;

  PERFORM public.adjust_global_balance(
    NEW."currencyMoney"::text,
    NEW."amountNeto",
    NEW.type::text,
    false,
    COALESCE(NEW."payData"->>'method', 'Transferencia')
  );

  RETURN NEW;
END;
$BODY$;

ALTER FUNCTION public.update_global_balance() OWNER TO upperdata;

INSERT INTO public."globalBalances" (
  "currencyMoney",
  "currentBalanceCash",
  "currentBalanceTransfer",
  "createdAt",
  "updatedAt"
)
SELECT
  'Dolar',
  COALESCE(SUM("currentBalanceCashUSD"), 0),
  COALESCE(SUM("currentBalanceTransferUSD"), 0),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM public."reserveAccounts"
ON CONFLICT ("currencyMoney") DO UPDATE
SET "currentBalanceCash" = EXCLUDED."currentBalanceCash",
    "currentBalanceTransfer" = EXCLUDED."currentBalanceTransfer",
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO public."globalBalances" (
  "currencyMoney",
  "currentBalanceCash",
  "currentBalanceTransfer",
  "createdAt",
  "updatedAt"
)
SELECT
  'Bolivar',
  COALESCE(SUM("currentBalanceCashVES"), 0),
  COALESCE(SUM("currentBalanceTransferVES"), 0),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM public."reserveAccounts"
ON CONFLICT ("currencyMoney") DO UPDATE
SET "currentBalanceCash" = EXCLUDED."currentBalanceCash",
    "currentBalanceTransfer" = EXCLUDED."currentBalanceTransfer",
    "updatedAt" = CURRENT_TIMESTAMP;

CREATE TRIGGER trg_update_global_balance
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_global_balance();

COMMIT;

SELECT pg_get_functiondef('public.adjust_global_balance(text,numeric,text,boolean,text)'::regprocedure);
SELECT pg_get_functiondef('public.update_global_balance()'::regprocedure);

SELECT t.tgname, pg_get_triggerdef(t.oid)
FROM pg_trigger AS t
WHERE t.tgrelid = 'public.transactions'::regclass
  AND NOT t.tgisinternal
  AND t.tgfoid = 'public.update_global_balance()'::regprocedure;
