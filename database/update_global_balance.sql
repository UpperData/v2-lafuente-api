BEGIN;

DO $block$
DECLARE
  v_trigger record;
BEGIN
  FOR v_trigger IN
    SELECT t.tgname
    FROM pg_trigger AS t
    JOIN pg_proc AS p ON p.oid = t.tgfoid
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE t.tgrelid = 'public.transactions'::regclass
      AND NOT t.tgisinternal
      AND n.nspname = 'public'
      AND p.proname = 'update_global_balance'
  LOOP
    EXECUTE format('DROP TRIGGER %I ON public.transactions', v_trigger.tgname);
  END LOOP;
END;
$block$;

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
  ELSIF p_currency = 'Euro' THEN
    INSERT INTO public."globalBalances" (
      "currencyMoney",
      "currentBalanceCash",
      "currentBalanceTransfer",
      "createdAt",
      "updatedAt"
    )
    SELECT
      'Euro',
      COALESCE(SUM("currentBalanceCashEUR"), 0),
      COALESCE(SUM("currentBalanceTransferEUR"), 0),
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
    OR p_currency NOT IN ('Dolar', 'Bolivar', 'Euro')
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
  ELSIF p_currency = 'Bolivar' THEN
    UPDATE public."globalBalances"
    SET "currentBalanceTransfer" = "currentBalanceTransfer" + v_balance_delta,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "currencyMoney" = 'Bolivar';
  ELSIF p_currency = 'Euro' AND v_payment_method = 'efectivo' THEN
    UPDATE public."globalBalances"
    SET "currentBalanceCash" = "currentBalanceCash" + v_balance_delta,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "currencyMoney" = 'Euro';
  ELSE
    UPDATE public."globalBalances"
    SET "currentBalanceTransfer" = "currentBalanceTransfer" + v_balance_delta,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "currencyMoney" = 'Euro';
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
DECLARE
  v_was_active boolean := false;
  v_is_active boolean := false;
  v_old_method text;
  v_new_method text;
  v_old_is_cash boolean := false;
  v_new_is_cash boolean := false;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_was_active := COALESCE(OLD."isActived", false);
    v_old_method := COALESCE(OLD."payData"->>'method', 'Transferencia');
    v_old_is_cash := lower(trim(v_old_method)) = 'efectivo';
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_is_active := COALESCE(NEW."isActived", false);
    v_new_method := COALESCE(NEW."payData"->>'method', 'Transferencia');
    v_new_is_cash := lower(trim(v_new_method)) = 'efectivo';
  END IF;

  IF NOT v_was_active AND NOT v_is_active THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF v_was_active AND v_is_active
    AND OLD."currencyMoney" IS NOT DISTINCT FROM NEW."currencyMoney"
    AND OLD."amountNeto" IS NOT DISTINCT FROM NEW."amountNeto"
    AND OLD.type IS NOT DISTINCT FROM NEW.type
    AND v_old_is_cash = v_new_is_cash
  THEN
    RETURN NEW;
  END IF;

  IF v_was_active THEN
    PERFORM public.adjust_global_balance(
      OLD."currencyMoney"::text,
      OLD."amountNeto",
      OLD.type::text,
      true,
      v_old_method
    );
  END IF;

  IF v_is_active THEN
    PERFORM public.adjust_global_balance(
      NEW."currencyMoney"::text,
      NEW."amountNeto",
      NEW.type::text,
      false,
      v_new_method
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

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

INSERT INTO public."globalBalances" (
  "currencyMoney",
  "currentBalanceCash",
  "currentBalanceTransfer",
  "createdAt",
  "updatedAt"
)
SELECT
  'Euro',
  COALESCE(SUM("currentBalanceCashEUR"), 0),
  COALESCE(SUM("currentBalanceTransferEUR"), 0),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM public."reserveAccounts"
ON CONFLICT ("currencyMoney") DO UPDATE
SET "currentBalanceCash" = EXCLUDED."currentBalanceCash",
    "currentBalanceTransfer" = EXCLUDED."currentBalanceTransfer",
    "updatedAt" = CURRENT_TIMESTAMP;

CREATE TRIGGER trg_update_global_balance
BEFORE INSERT OR UPDATE OR DELETE ON public.transactions
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
