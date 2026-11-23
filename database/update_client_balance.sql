BEGIN;

ALTER TABLE public."bankAccount"
  ADD COLUMN IF NOT EXISTS balance numeric(18, 2) NOT NULL DEFAULT 0;

ALTER TABLE public."boxCash"
  ALTER COLUMN balance TYPE numeric(18, 2);

CREATE UNIQUE INDEX IF NOT EXISTS "boxCash_currencyMoney_unique"
  ON public."boxCash" ("currencyMoney");

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

CREATE OR REPLACE FUNCTION public.adjust_reserve_account_balance(
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
    OR p_currency NOT IN ('Dolar', 'Bolivar', 'Euro')
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
  ELSIF p_currency = 'Bolivar' THEN
    UPDATE public."reserveAccounts"
    SET "currentBalanceTransferVES" = "currentBalanceTransferVES" + v_balance_delta
    WHERE id = p_reserve_account_id
      AND "currentBalanceTransferVES" + v_balance_delta >= 0;
  ELSIF v_payment_method = 'efectivo' THEN
    UPDATE public."reserveAccounts"
    SET "currentBalanceCashEUR" = "currentBalanceCashEUR" + v_balance_delta
    WHERE id = p_reserve_account_id
      AND "currentBalanceCashEUR" + v_balance_delta >= 0;
  ELSE
    UPDATE public."reserveAccounts"
    SET "currentBalanceTransferEUR" = "currentBalanceTransferEUR" + v_balance_delta
    WHERE id = p_reserve_account_id
      AND "currentBalanceTransferEUR" + v_balance_delta >= 0;
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

CREATE OR REPLACE FUNCTION public.adjust_bank_account_balance(
  p_bank_account_id text,
  p_currency text,
  p_amount numeric,
  p_type text,
  p_reverse boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
COST 100
VOLATILE
PARALLEL UNSAFE
AS $BODY$
DECLARE
  v_balance_delta numeric(18, 2);
BEGIN
  IF p_bank_account_id IS NULL
    OR p_type NOT IN ('input', 'output')
    OR p_amount IS NULL
    OR p_amount <= 0
    OR p_currency NOT IN ('Dolar', 'Bolivar', 'Euro')
  THEN
    RAISE EXCEPTION 'Datos inválidos para actualizar el saldo de la cuenta bancaria.'
      USING ERRCODE = '23514';
  END IF;

  IF p_bank_account_id !~ '^[1-9][0-9]*$'
    OR length(p_bank_account_id) > 10
  THEN
    RAISE EXCEPTION 'El identificador de cuenta bancaria no es válido.'
      USING ERRCODE = '23514';
  END IF;

  IF p_bank_account_id::numeric > 2147483647 THEN
    RAISE EXCEPTION 'El identificador de cuenta bancaria no es válido.'
      USING ERRCODE = '23514';
  END IF;

  v_balance_delta := CASE
    WHEN p_type = 'input' THEN -p_amount
    ELSE p_amount
  END;

  IF p_reverse THEN
    v_balance_delta := -v_balance_delta;
  END IF;

  UPDATE public."bankAccount"
  SET balance = balance + v_balance_delta,
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE id = p_bank_account_id::integer
    AND "currencyMoney"::text = p_currency;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La cuenta bancaria indicada no existe o su moneda no coincide con la transacción.'
      USING ERRCODE = '23514';
  END IF;
END;
$BODY$;

ALTER FUNCTION public.adjust_bank_account_balance(
  text, text, numeric, text, boolean
) OWNER TO upperdata;

CREATE OR REPLACE FUNCTION public.ensure_box_cash(p_currency text)
RETURNS void
LANGUAGE plpgsql
COST 100
VOLATILE
PARALLEL UNSAFE
AS $BODY$
BEGIN
  IF p_currency = 'Dolar' THEN
    INSERT INTO public."boxCash" (
      name,
      balance,
      "isActived",
      "currencyMoney",
      "createdAt",
      "updatedAt"
    )
    SELECT
      'La Fuentes - cash - Dolar',
      COALESCE(SUM("currentBalanceCashUSD"), 0),
      true,
      'Dolar'::public."enum_boxCash_currencyMoney",
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    FROM public."reserveAccounts"
    ON CONFLICT ("currencyMoney") DO NOTHING;
  ELSIF p_currency = 'Bolivar' THEN
    INSERT INTO public."boxCash" (
      name,
      balance,
      "isActived",
      "currencyMoney",
      "createdAt",
      "updatedAt"
    )
    SELECT
      'La Fuentes - cash - Bolivar',
      COALESCE(SUM("currentBalanceCashVES"), 0),
      true,
      'Bolivar'::public."enum_boxCash_currencyMoney",
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    FROM public."reserveAccounts"
    ON CONFLICT ("currencyMoney") DO NOTHING;
  ELSIF p_currency = 'Euro' THEN
    INSERT INTO public."boxCash" (
      name,
      balance,
      "isActived",
      "currencyMoney",
      "createdAt",
      "updatedAt"
    )
    SELECT
      'La Fuentes - cash - Euro',
      COALESCE(SUM("currentBalanceCashEUR"), 0),
      true,
      'Euro'::public."enum_boxCash_currencyMoney",
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    FROM public."reserveAccounts"
    ON CONFLICT ("currencyMoney") DO NOTHING;
  ELSE
    RAISE EXCEPTION 'Moneda no soportada para actualizar el saldo de caja.'
      USING ERRCODE = '23514';
  END IF;
END;
$BODY$;

ALTER FUNCTION public.ensure_box_cash(text) OWNER TO upperdata;

CREATE OR REPLACE FUNCTION public.adjust_box_cash_balance(
  p_currency text,
  p_amount numeric,
  p_type text,
  p_reverse boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
COST 100
VOLATILE
PARALLEL UNSAFE
AS $BODY$
DECLARE
  v_balance_delta numeric(18, 2);
BEGIN
  IF p_type NOT IN ('input', 'output')
    OR p_amount IS NULL
    OR p_amount <= 0
    OR p_currency NOT IN ('Dolar', 'Bolivar', 'Euro')
  THEN
    RAISE EXCEPTION 'Datos inválidos para actualizar el saldo de caja.'
      USING ERRCODE = '23514';
  END IF;

  v_balance_delta := CASE
    WHEN p_type = 'input' THEN p_amount
    ELSE -p_amount
  END;

  IF p_reverse THEN
    v_balance_delta := -v_balance_delta;
  END IF;

  PERFORM public.ensure_box_cash(p_currency);

  UPDATE public."boxCash"
  SET balance = balance + v_balance_delta,
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE "currencyMoney"::text = p_currency;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No fue posible actualizar el saldo de caja.'
      USING ERRCODE = '23514';
  END IF;
END;
$BODY$;

ALTER FUNCTION public.adjust_box_cash_balance(
  text, numeric, text, boolean
) OWNER TO upperdata;

CREATE OR REPLACE FUNCTION public.update_client_balance()
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
  v_old_bank_account_id text;
  v_new_bank_account_id text;
  v_same_reserve_bucket boolean := false;
  v_old_signed numeric(12, 2);
  v_new_signed numeric(12, 2);
  v_net_delta numeric(12, 2);
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_was_active := COALESCE(OLD."isActived", false);
    v_old_method := COALESCE(OLD."payData"->>'method', 'Transferencia');
    v_old_is_cash := lower(trim(v_old_method)) = 'efectivo';
    v_old_bank_account_id := NULLIF(
      trim(COALESCE(OLD."payData"->'destinationAccount'->>'bankAccountId', '')),
      ''
    );
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_is_active := COALESCE(NEW."isActived", false);
    v_new_method := COALESCE(NEW."payData"->>'method', 'Transferencia');
    v_new_is_cash := lower(trim(v_new_method)) = 'efectivo';
    v_new_bank_account_id := NULLIF(
      trim(COALESCE(NEW."payData"->'destinationAccount'->>'bankAccountId', '')),
      ''
    );
  END IF;

  IF NOT v_was_active AND NOT v_is_active THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF v_is_active AND NOT v_new_is_cash AND v_new_bank_account_id IS NULL THEN
    RAISE EXCEPTION 'Debe indicar payData.destinationAccount.bankAccountId para actualizar el saldo de la cuenta bancaria.'
      USING ERRCODE = '23514';
  END IF;

  IF v_was_active AND v_is_active THEN
    IF OLD."reserveAccountId" IS NOT DISTINCT FROM NEW."reserveAccountId"
      AND OLD."currencyMoney" IS NOT DISTINCT FROM NEW."currencyMoney"
      AND OLD."amountNeto" IS NOT DISTINCT FROM NEW."amountNeto"
      AND OLD.type IS NOT DISTINCT FROM NEW.type
      AND v_old_is_cash = v_new_is_cash
      AND v_old_bank_account_id IS NOT DISTINCT FROM v_new_bank_account_id
    THEN
      RETURN NEW;
    END IF;

    IF v_old_bank_account_id IS DISTINCT FROM v_new_bank_account_id
      OR OLD."currencyMoney" IS DISTINCT FROM NEW."currencyMoney"
      OR OLD."amountNeto" IS DISTINCT FROM NEW."amountNeto"
      OR OLD.type IS DISTINCT FROM NEW.type
    THEN
      IF v_old_bank_account_id IS NOT NULL THEN
        PERFORM public.adjust_bank_account_balance(
          v_old_bank_account_id,
          OLD."currencyMoney"::text,
          OLD."amountNeto",
          OLD.type::text,
          true
        );
      END IF;

      IF v_new_bank_account_id IS NOT NULL THEN
        PERFORM public.adjust_bank_account_balance(
          v_new_bank_account_id,
          NEW."currencyMoney"::text,
          NEW."amountNeto",
          NEW.type::text,
          false
        );
      END IF;
    END IF;

    IF (v_old_is_cash OR v_new_is_cash)
      AND (
        v_old_is_cash <> v_new_is_cash
        OR OLD."currencyMoney" IS DISTINCT FROM NEW."currencyMoney"
        OR OLD."amountNeto" IS DISTINCT FROM NEW."amountNeto"
        OR OLD.type IS DISTINCT FROM NEW.type
      )
    THEN
      IF v_old_is_cash THEN
        PERFORM public.adjust_box_cash_balance(
          OLD."currencyMoney"::text,
          OLD."amountNeto",
          OLD.type::text,
          true
        );
      END IF;

      IF v_new_is_cash THEN
        PERFORM public.adjust_box_cash_balance(
          NEW."currencyMoney"::text,
          NEW."amountNeto",
          NEW.type::text,
          false
        );
      END IF;
    END IF;

    v_same_reserve_bucket :=
      OLD."reserveAccountId" IS NOT DISTINCT FROM NEW."reserveAccountId"
      AND OLD."currencyMoney" IS NOT DISTINCT FROM NEW."currencyMoney"
      AND v_old_is_cash = v_new_is_cash;

    IF v_same_reserve_bucket THEN
      IF OLD.type::text NOT IN ('input', 'output')
        OR OLD."amountNeto" IS NULL
        OR OLD."amountNeto" <= 0
        OR OLD."currencyMoney"::text NOT IN ('Dolar', 'Bolivar', 'Euro')
        OR NEW.type::text NOT IN ('input', 'output')
        OR NEW."amountNeto" IS NULL
        OR NEW."amountNeto" <= 0
        OR NEW."currencyMoney"::text NOT IN ('Dolar', 'Bolivar', 'Euro')
      THEN
        RAISE EXCEPTION 'Datos de transacción inválidos para actualizar el saldo.'
          USING ERRCODE = '23514';
      END IF;

      v_old_signed := CASE
        WHEN OLD.type::text = 'input' THEN OLD."amountNeto"
        ELSE -OLD."amountNeto"
      END;
      v_new_signed := CASE
        WHEN NEW.type::text = 'input' THEN NEW."amountNeto"
        ELSE -NEW."amountNeto"
      END;
      v_net_delta := v_new_signed - v_old_signed;

      IF v_net_delta > 0 THEN
        PERFORM public.adjust_reserve_account_balance(
          NEW."reserveAccountId",
          NEW."currencyMoney"::text,
          v_net_delta,
          'input',
          false,
          v_new_method
        );
      ELSIF v_net_delta < 0 THEN
        PERFORM public.adjust_reserve_account_balance(
          NEW."reserveAccountId",
          NEW."currencyMoney"::text,
          -v_net_delta,
          'output',
          false,
          v_new_method
        );
      END IF;
    ELSE
      PERFORM public.adjust_reserve_account_balance(
        OLD."reserveAccountId",
        OLD."currencyMoney"::text,
        OLD."amountNeto",
        OLD.type::text,
        true,
        v_old_method
      );

      PERFORM public.adjust_reserve_account_balance(
        NEW."reserveAccountId",
        NEW."currencyMoney"::text,
        NEW."amountNeto",
        NEW.type::text,
        false,
        v_new_method
      );
    END IF;

    RETURN NEW;
  END IF;

  IF v_was_active THEN
    IF v_old_bank_account_id IS NOT NULL THEN
      PERFORM public.adjust_bank_account_balance(
        v_old_bank_account_id,
        OLD."currencyMoney"::text,
        OLD."amountNeto",
        OLD.type::text,
        true
      );
    END IF;

    IF v_old_is_cash THEN
      PERFORM public.adjust_box_cash_balance(
        OLD."currencyMoney"::text,
        OLD."amountNeto",
        OLD.type::text,
        true
      );
    END IF;

    PERFORM public.adjust_reserve_account_balance(
      OLD."reserveAccountId",
      OLD."currencyMoney"::text,
      OLD."amountNeto",
      OLD.type::text,
      true,
      v_old_method
    );
  END IF;

  IF v_is_active THEN
    IF v_new_bank_account_id IS NOT NULL THEN
      PERFORM public.adjust_bank_account_balance(
        v_new_bank_account_id,
        NEW."currencyMoney"::text,
        NEW."amountNeto",
        NEW.type::text,
        false
      );
    END IF;

    IF v_new_is_cash THEN
      PERFORM public.adjust_box_cash_balance(
        NEW."currencyMoney"::text,
        NEW."amountNeto",
        NEW.type::text,
        false
      );
    END IF;

    PERFORM public.adjust_reserve_account_balance(
      NEW."reserveAccountId",
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

ALTER FUNCTION public.update_client_balance() OWNER TO upperdata;

SELECT public.ensure_box_cash('Dolar');
SELECT public.ensure_box_cash('Bolivar');
SELECT public.ensure_box_cash('Euro');

CREATE TRIGGER trg_update_client_balance
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_client_balance();

COMMIT;

SELECT pg_get_functiondef(
  'public.adjust_reserve_account_balance(integer,text,numeric,text,boolean,text)'::regprocedure
);
SELECT pg_get_functiondef(
  'public.adjust_bank_account_balance(text,text,numeric,text,boolean)'::regprocedure
);
SELECT pg_get_functiondef(
  'public.ensure_box_cash(text)'::regprocedure
);
SELECT pg_get_functiondef(
  'public.adjust_box_cash_balance(text,numeric,text,boolean)'::regprocedure
);

SELECT pg_get_functiondef('public.update_client_balance()'::regprocedure);

SELECT t.tgname, pg_get_triggerdef(t.oid)
FROM pg_trigger AS t
WHERE t.tgrelid = 'public.transactions'::regclass
  AND NOT t.tgisinternal
  AND t.tgfoid = 'public.update_client_balance()'::regprocedure;
