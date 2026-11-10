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
      AND p.proname = 'update_client_balance'
  LOOP
    EXECUTE format('DROP TRIGGER %I ON public.transactions', v_trigger.tgname);
  END LOOP;
END;
$block$;

DROP FUNCTION IF EXISTS public.adjust_reserve_account_balance(
  integer, text, numeric, text, boolean
);

CREATE FUNCTION public.adjust_reserve_account_balance(
  p_reserve_account_id integer,
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
  v_balance_delta numeric(12, 2);
  v_payment_method text;
BEGIN
  IF p_type NOT IN ('input', 'output')
    OR p_amount IS NULL
    OR p_amount <= 0
    OR p_currency NOT IN ('Dolar', 'Bolivar')
  THEN
    RAISE EXCEPTION 'Datos de transacción inválidos para actualizar el saldo.'
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

  IF p_currency = 'Dolar' AND v_payment_method = 'efectivo' THEN
    UPDATE public."reserveAccounts"
    SET "currentBalanceCashUSD" = "currentBalanceCashUSD" + v_balance_delta
    WHERE id = p_reserve_account_id
      AND "currentBalanceCashUSD" + v_balance_delta >= 0;
  ELSIF p_currency = 'Dolar' THEN
    UPDATE public."reserveAccounts"
    SET "currentBalanceTransferUSD" = "currentBalanceTransferUSD" + v_balance_delta
    WHERE id = p_reserve_account_id
      AND "currentBalanceTransferUSD" + v_balance_delta >= 0;
  ELSIF p_currency = 'Bolivar' AND v_payment_method = 'efectivo' THEN
    UPDATE public."reserveAccounts"
    SET "currentBalanceCashVES" = "currentBalanceCashVES" + v_balance_delta
    WHERE id = p_reserve_account_id
      AND "currentBalanceCashVES" + v_balance_delta >= 0;
  ELSE
    UPDATE public."reserveAccounts"
    SET "currentBalanceTransferVES" = "currentBalanceTransferVES" + v_balance_delta
    WHERE id = p_reserve_account_id
      AND "currentBalanceTransferVES" + v_balance_delta >= 0;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La cuenta no existe o no tiene saldo suficiente para esta transacción.'
      USING ERRCODE = '23514';
  END IF;
END;
$BODY$;

ALTER FUNCTION public.adjust_reserve_account_balance(
  integer, text, numeric, text, boolean, text
) OWNER TO upperdata;

CREATE OR REPLACE FUNCTION public.update_client_balance()
RETURNS trigger
LANGUAGE plpgsql
COST 100
VOLATILE
AS $BODY$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    PERFORM public.adjust_reserve_account_balance(
      OLD."reserveAccountId",
      OLD."currencyMoney"::text,
      OLD."amountNeto",
      OLD.type::text,
      true,
      COALESCE(OLD."payData"->>'method', 'Transferencia')
    );
  END IF;

  PERFORM public.adjust_reserve_account_balance(
    NEW."reserveAccountId",
    NEW."currencyMoney"::text,
    NEW."amountNeto",
    NEW.type::text,
    false,
    COALESCE(NEW."payData"->>'method', 'Transferencia')
  );

  RETURN NEW;
END;
$BODY$;

ALTER FUNCTION public.update_client_balance() OWNER TO upperdata;

CREATE TRIGGER trg_update_client_balance
AFTER INSERT OR UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_client_balance();

COMMIT;

SELECT pg_get_functiondef(
  'public.adjust_reserve_account_balance(integer,text,numeric,text,boolean,text)'::regprocedure
);

SELECT pg_get_functiondef('public.update_client_balance()'::regprocedure);

SELECT t.tgname, pg_get_triggerdef(t.oid)
FROM pg_trigger AS t
WHERE t.tgrelid = 'public.transactions'::regclass
  AND NOT t.tgisinternal
  AND t.tgfoid = 'public.update_client_balance()'::regprocedure;
