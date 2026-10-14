-- Additive Domestic-only storage. Existing expenses and browser copies stay intact.
ALTER TABLE public.dom_expenses
  ADD COLUMN payment_condition text NOT NULL DEFAULT 'contado'
    CHECK (payment_condition IN ('contado', 'cuenta_corriente')),
  ADD COLUMN due_date date;

CREATE UNIQUE INDEX dom_expenses_persona_id_uidx
  ON public.dom_expenses (persona_padre_id, id);

CREATE TABLE public.dom_expense_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_padre_id integer NOT NULL,
  expense_id bigint NOT NULL,
  amount numeric(16, 2) NOT NULL CHECK (amount > 0),
  payment_condition text NOT NULL CHECK (payment_condition IN ('contado', 'cuenta_corriente')),
  due_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dom_expense_receipts_due_date_check
    CHECK (payment_condition <> 'cuenta_corriente' OR due_date IS NOT NULL),
  CONSTRAINT dom_expense_receipts_expense_fkey
    FOREIGN KEY (persona_padre_id, expense_id)
    REFERENCES public.dom_expenses (persona_padre_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX dom_expense_receipts_persona_due_idx
  ON public.dom_expense_receipts (persona_padre_id, due_date);
CREATE INDEX dom_expense_receipts_persona_expense_idx
  ON public.dom_expense_receipts (persona_padre_id, expense_id);

ALTER TABLE public.dom_expense_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.dom_expense_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dom_expense_receipts TO authenticated;

CREATE POLICY dom_expense_receipts_authenticated_owner
  ON public.dom_expense_receipts
  FOR ALL TO authenticated
  USING (persona_padre_id = (SELECT public.dom_current_persona_padre_id()))
  WITH CHECK (persona_padre_id = (SELECT public.dom_current_persona_padre_id()));
