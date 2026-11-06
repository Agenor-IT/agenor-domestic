-- Prepared locally. Do not apply to production without destination-specific authorization.
BEGIN;

CREATE UNIQUE INDEX dom_consumption_transactions_owner_uidx ON public.dom_transactions(persona_padre_id, id);
CREATE TABLE public.dom_consumption_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_padre_id integer NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 300),
  presentation text NOT NULL DEFAULT '' CHECK (length(presentation) <= 120),
  unit text NOT NULL CHECK (length(btrim(unit)) BETWEEN 1 AND 32),
  kind text NOT NULL CHECK (kind IN ('consumable','durable')),
  name_key text GENERATED ALWAYS AS (lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))) STORED,
  presentation_key text GENERATED ALWAYS AS (lower(regexp_replace(btrim(presentation), '\s+', ' ', 'g'))) STORED,
  unit_key text GENERATED ALWAYS AS (lower(regexp_replace(btrim(unit), '\s+', ' ', 'g'))) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (persona_padre_id,id),
  UNIQUE (persona_padre_id,name_key,presentation_key,unit_key,kind)
);
CREATE TABLE public.dom_purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_padre_id integer NOT NULL,
  transaction_id uuid NOT NULL,
  transaction_revision integer NOT NULL CHECK (transaction_revision > 0),
  line_number integer NOT NULL CHECK (line_number BETWEEN 1 AND 100),
  product_id uuid NOT NULL,
  raw_name text NOT NULL CHECK (length(btrim(raw_name)) BETWEEN 1 AND 300),
  quantity numeric CHECK (quantity > 0 AND quantity <= 999999999 AND round(quantity,3)=quantity AND quantity <> 'NaN'::numeric),
  line_total numeric CHECK (line_total >= 0 AND line_total <= 999999999 AND round(line_total,2)=line_total AND line_total <> 'NaN'::numeric),
  CONSTRAINT dom_purchase_items_transaction_fkey FOREIGN KEY (persona_padre_id,transaction_id)
    REFERENCES public.dom_transactions(persona_padre_id,id) ON DELETE RESTRICT,
  CONSTRAINT dom_purchase_items_product_fkey FOREIGN KEY (persona_padre_id,product_id)
    REFERENCES public.dom_consumption_products(persona_padre_id,id) ON DELETE RESTRICT,
  UNIQUE (persona_padre_id,transaction_id,line_number)
);
CREATE INDEX dom_purchase_items_product_idx ON public.dom_purchase_items(persona_padre_id,product_id,transaction_id);
CREATE TABLE public.dom_shopping_items (
  id uuid PRIMARY KEY,
  persona_padre_id integer NOT NULL,
  product_id uuid NOT NULL,
  quantity numeric CHECK (quantity > 0 AND quantity <= 999999999 AND round(quantity,3)=quantity AND quantity <> 'NaN'::numeric),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  checked boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  CONSTRAINT dom_shopping_items_product_fkey FOREIGN KEY (persona_padre_id,product_id)
    REFERENCES public.dom_consumption_products(persona_padre_id,id) ON DELETE RESTRICT,
  UNIQUE (persona_padre_id,product_id)
);

ALTER TABLE public.dom_consumption_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dom_purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dom_shopping_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dom_consumption_products,public.dom_purchase_items,public.dom_shopping_items FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.dom_consumption_products,public.dom_purchase_items,public.dom_shopping_items TO authenticated;
CREATE POLICY dom_consumption_products_owner ON public.dom_consumption_products FOR SELECT TO authenticated
  USING (persona_padre_id=(SELECT public.dom_current_persona_padre_id()));
CREATE POLICY dom_purchase_items_owner ON public.dom_purchase_items FOR SELECT TO authenticated
  USING (persona_padre_id=(SELECT public.dom_current_persona_padre_id()));
CREATE POLICY dom_shopping_items_owner ON public.dom_shopping_items FOR SELECT TO authenticated
  USING (persona_padre_id=(SELECT public.dom_current_persona_padre_id()));

CREATE FUNCTION public.dom_consumption_contract(p_persona_padre_id integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM public.dom_assert_tenant_access(p_persona_padre_id);
  RETURN '{"version":1,"estimation":"purchase_intervals_v1","minimumPurchaseDays":2}'::jsonb;
END;
$$;

-- Internal helper: only the function owner can call it. Catalog identity never changes the unit
-- or presentation of a previous purchase. Similar names are not automatically merged.
CREATE FUNCTION public.dom_resolve_consumption_product(p_persona_padre_id integer,p_product jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_id uuid;
  v_name text:=btrim(p_product->>'name');
  v_presentation text:=btrim(coalesce(p_product->>'presentation',''));
  v_unit text:=btrim(p_product->>'unit');
  v_kind text:=p_product->>'kind';
BEGIN
  PERFORM public.dom_assert_tenant_access(p_persona_padre_id);
  IF jsonb_typeof(p_product) IS DISTINCT FROM 'object' OR
     coalesce(length(v_name),0) NOT BETWEEN 1 AND 300 OR length(v_presentation)>120 OR
     coalesce(length(v_unit),0) NOT BETWEEN 1 AND 32 OR coalesce(v_kind,'') NOT IN ('consumable','durable') THEN
    RAISE EXCEPTION 'Producto, presentación o unidad inválidos' USING errcode='22023';
  END IF;
  IF nullif(p_product->>'productId','') IS NOT NULL THEN
    SELECT id INTO v_id FROM public.dom_consumption_products
    WHERE id=(p_product->>'productId')::uuid AND persona_padre_id=p_persona_padre_id
      AND name=v_name AND presentation=v_presentation AND unit=v_unit AND kind=v_kind;
    IF NOT FOUND THEN RAISE EXCEPTION 'El producto vinculado cambió o no pertenece al hogar' USING errcode='22023'; END IF;
    RETURN v_id;
  END IF;
  INSERT INTO public.dom_consumption_products(persona_padre_id,name,presentation,unit,kind)
    VALUES (p_persona_padre_id,v_name,v_presentation,v_unit,v_kind)
    ON CONFLICT (persona_padre_id,name_key,presentation_key,unit_key,kind) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.dom_consumption_products
    WHERE persona_padre_id=p_persona_padre_id
      AND name_key=lower(regexp_replace(v_name,'\s+',' ','g'))
      AND presentation_key=lower(regexp_replace(v_presentation,'\s+',' ','g'))
      AND unit_key=lower(regexp_replace(v_unit,'\s+',' ','g')) AND kind=v_kind;
  END IF;
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.dom_create_consumption_product(p_persona_padre_id integer,p_product jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM public.dom_assert_tenant_access(p_persona_padre_id);
  PERFORM pg_catalog.pg_advisory_xact_lock(21452,p_persona_padre_id);
  RETURN public.dom_resolve_consumption_product(p_persona_padre_id,p_product);
END;
$$;

CREATE FUNCTION public.dom_post_purchase_transaction(
  p_persona_padre_id integer,p_id uuid,p_expected_revision integer,
  p_transaction jsonb,p_lines jsonb,p_purchase_items jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_result jsonb;
  v_item jsonb;
  v_product_id uuid;
  v_number integer:=0;
  v_quantity numeric;
  v_total numeric;
BEGIN
  PERFORM public.dom_assert_tenant_access(p_persona_padre_id);
  PERFORM pg_catalog.pg_advisory_xact_lock(21452,p_persona_padre_id);
  IF jsonb_typeof(p_purchase_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_purchase_items)>100 OR
     coalesce(p_transaction->>'operation_type','')<>'compra' OR coalesce(p_transaction->>'direction','')<>'expense' THEN
    RAISE EXCEPTION 'El detalle de productos sólo corresponde a compras, hasta 100 renglones' USING errcode='22023';
  END IF;
  -- Include the detail in the EXISTING fingerprint. A retry is idempotent and changing only
  -- a quantity still advances the transaction revision. All later failures roll back the entry.
  v_result:=public.dom_post_transaction(p_persona_padre_id,p_id,p_expected_revision,
    p_transaction||jsonb_build_object('purchase_items',p_purchase_items),p_lines);
  IF coalesce((v_result->>'replayed')::boolean,false) THEN RETURN v_result; END IF;
  IF (v_result->>'success')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'No se registró la compra'; END IF;
  DELETE FROM public.dom_purchase_items WHERE persona_padre_id=p_persona_padre_id AND transaction_id=p_id;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_purchase_items) LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' OR
       coalesce(length(btrim(v_item->>'rawName')),0) NOT BETWEEN 1 AND 300 OR
       jsonb_typeof(v_item->'quantity') IS NULL OR jsonb_typeof(v_item->'quantity') NOT IN ('number','null') OR
       jsonb_typeof(v_item->'lineTotal') IS NULL OR jsonb_typeof(v_item->'lineTotal') NOT IN ('number','null') THEN
      RAISE EXCEPTION 'Renglón de compra inválido' USING errcode='22023';
    END IF;
    v_quantity:=(v_item->>'quantity')::numeric;
    v_total:=(v_item->>'lineTotal')::numeric;
    v_product_id:=public.dom_resolve_consumption_product(p_persona_padre_id,v_item);
    v_number:=v_number+1;
    INSERT INTO public.dom_purchase_items(persona_padre_id,transaction_id,transaction_revision,line_number,
      product_id,raw_name,quantity,line_total)
    VALUES (p_persona_padre_id,p_id,(v_result->>'revision')::integer,v_number,v_product_id,
      btrim(v_item->>'rawName'),v_quantity,v_total);
  END LOOP;
  RETURN v_result;
END;
$$;

CREATE FUNCTION public.dom_save_shopping_item(p_persona_padre_id integer,p_item jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_existing public.dom_shopping_items%ROWTYPE;
  v_id uuid:=(p_item->>'id')::uuid;
  v_product uuid:=(p_item->>'productId')::uuid;
  v_expected integer:=(p_item->>'revision')::integer;
BEGIN
  PERFORM public.dom_assert_tenant_access(p_persona_padre_id);
  PERFORM pg_catalog.pg_advisory_xact_lock(21452,p_persona_padre_id);
  IF v_id IS NULL OR v_expected IS NULL OR v_expected<0 OR
     jsonb_typeof(p_item->'quantity') IS NULL OR jsonb_typeof(p_item->'quantity') NOT IN ('number','null') OR
     jsonb_typeof(p_item->'checked') IS DISTINCT FROM 'boolean' OR
     jsonb_typeof(p_item->'note') IS DISTINCT FROM 'string' OR NOT EXISTS (
    SELECT 1 FROM public.dom_consumption_products WHERE id=v_product AND persona_padre_id=p_persona_padre_id
  ) THEN RAISE EXCEPTION 'Elemento de lista inválido' USING errcode='22023'; END IF;
  SELECT * INTO v_existing FROM public.dom_shopping_items WHERE id=v_id AND persona_padre_id=p_persona_padre_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.revision<>v_expected THEN RAISE EXCEPTION 'La lista cambió; actualizala antes de editar' USING errcode='40001'; END IF;
    UPDATE public.dom_shopping_items SET quantity=(p_item->>'quantity')::numeric,note=p_item->>'note',
      checked=(p_item->>'checked')::boolean,revision=revision+1
    WHERE id=v_id AND persona_padre_id=p_persona_padre_id AND product_id=v_product;
    IF NOT FOUND THEN RAISE EXCEPTION 'No se puede cambiar el producto de un renglón' USING errcode='22023'; END IF;
  ELSE
    IF v_expected<>0 THEN RAISE EXCEPTION 'El elemento ya no existe' USING errcode='40001'; END IF;
    INSERT INTO public.dom_shopping_items(id,persona_padre_id,product_id,quantity,note,checked)
      VALUES(v_id,p_persona_padre_id,v_product,(p_item->>'quantity')::numeric,p_item->>'note',(p_item->>'checked')::boolean);
  END IF;
END;
$$;
CREATE FUNCTION public.dom_delete_shopping_item(p_persona_padre_id integer,p_id uuid,p_expected_revision integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM public.dom_assert_tenant_access(p_persona_padre_id);
  PERFORM pg_catalog.pg_advisory_xact_lock(21452,p_persona_padre_id);
  DELETE FROM public.dom_shopping_items WHERE persona_padre_id=p_persona_padre_id AND id=p_id AND revision=p_expected_revision;
  IF NOT FOUND THEN RAISE EXCEPTION 'La lista cambió; actualizala antes de eliminar' USING errcode='40001'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.dom_resolve_consumption_product(integer,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.dom_consumption_contract(integer),public.dom_create_consumption_product(integer,jsonb),
  public.dom_post_purchase_transaction(integer,uuid,integer,jsonb,jsonb,jsonb),
  public.dom_save_shopping_item(integer,jsonb),public.dom_delete_shopping_item(integer,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dom_consumption_contract(integer),public.dom_create_consumption_product(integer,jsonb),
  public.dom_post_purchase_transaction(integer,uuid,integer,jsonb,jsonb,jsonb),
  public.dom_save_shopping_item(integer,jsonb),public.dom_delete_shopping_item(integer,uuid,integer) TO authenticated;
COMMIT;
