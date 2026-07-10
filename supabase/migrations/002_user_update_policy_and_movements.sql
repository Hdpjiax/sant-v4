-- ============================================================
-- Santander Demo - Migración 002
-- 1. RLS: usuarios pueden actualizar sus propios ajustes
-- 2. Función mejorada de movimientos realistas al registrarse
-- ============================================================

-- 1. Permitir que usuarios actualicen su propio user_settings
DROP POLICY IF EXISTS "Users update own settings" ON public.user_settings;
CREATE POLICY "Users update own settings"
    ON public.user_settings FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 2. Función para generar movimientos realistas
CREATE OR REPLACE FUNCTION public.generate_realistic_movements()
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    result JSONB := '[]'::jsonb;
    mov JSONB;
    days_ago INT;
    day_offset INT;
    mov_date TEXT;
    rnd REAL;
    rnd2 REAL;
    rnd3 REAL;
    amount_val TEXT;
    merchants TEXT[][] := ARRAY[
        -- (title, location, min_amount, max_amount, type)
        ARRAY['METROBUSL1PA', 'CIUDAD DE MEX', '6.00', '6.00', 'negative'],
        ARRAY['SUPERVASCO D', 'MEXICO DF', '38.00', '185.00', 'negative'],
        ARRAY['REBEL WINGS', 'CIUDAD DE MEX', '180.00', '450.00', 'negative'],
        ARRAY['UBER *VIAJE', 'CDMX', '45.00', '180.00', 'negative'],
        ARRAY['DIDI FOOD', 'MEXICO', '89.00', '320.00', 'negative'],
        ARRAY['CINEPOLIS', 'CIUDAD DE MEX', '89.00', '250.00', 'negative'],
        ARRAY['FARMACIA GUADALAJARA', 'CDMX', '120.00', '850.00', 'negative'],
        ARRAY['WALMART', 'MEXICO DF', '350.00', '2500.00', 'negative'],
        ARRAY['SORIANA', 'CDMX', '180.00', '1200.00', 'negative'],
        ARRAY['HEB', 'CIUDAD DE MEX', '250.00', '1800.00', 'negative'],
        ARRAY['SAMS CLUB', 'MEXICO DF', '600.00', '3500.00', 'negative'],
        ARRAY['COSTCO', 'CIUDAD DE MEX', '500.00', '4000.00', 'negative'],
        ARRAY['NETFLIX', 'MEXICO', '139.00', '299.00', 'negative'],
        ARRAY['SPOTIFY', 'MEXICO', '129.00', '129.00', 'negative'],
        ARRAY['AMAZON MX', 'CIUDAD DE MEX', '150.00', '3500.00', 'negative'],
        ARRAY['MERCADO LIBRE', 'CDMX', '200.00', '2800.00', 'negative'],
        ARRAY['SHELL GAS', 'MEXICO DF', '500.00', '1200.00', 'negative'],
        ARRAY['PEMEX', 'CIUDAD DE MEX', '400.00', '1000.00', 'negative'],
        ARRAY['TACOS EL PASTOR', 'CDMX', '80.00', '250.00', 'negative'],
        ARRAY['STARBUCKS', 'MEXICO DF', '65.00', '180.00', 'negative'],
        ARRAY['LA COMER', 'CIUDAD DE MEX', '300.00', '1500.00', 'negative'],
        ARRAY['CITY CLUB', 'MEXICO DF', '400.00', '2000.00', 'negative'],
        ARRAY['MOVISTAR', 'CDMX', '299.00', '899.00', 'negative'],
        ARRAY['TELCEL', 'MEXICO', '200.00', '500.00', 'negative'],
        ARRAY['INFINITUM', 'CDMX', '599.00', '599.00', 'negative'],
        ARRAY['CFE', 'CIUDAD DE MEX', '350.00', '1200.00', 'negative'],
        ARRAY['OFFICE DEPOT', 'MEXICO DF', '150.00', '1200.00', 'negative'],
        ARRAY['SEARS', 'CIUDAD DE MEX', '400.00', '3500.00', 'negative'],
        ARRAY['PALACIO DE HIERRO', 'CDMX', '500.00', '5000.00', 'negative'],
        ARRAY['ZARA', 'MEXICO DF', '400.00', '2500.00', 'negative']
    ];
    transfer_amounts NUMERIC[] := ARRAY[500, 1000, 1500, 2000, 2500, 3000, 4000, 5000];
    idx INT;
    base_ref INT;
    min_amt NUMERIC;
    max_amt NUMERIC;
    chosen_amt NUMERIC;
    num_movements INT;
    transfer_count INT;
    used_indices INT[] := '{}';
BEGIN
    num_movements := 12 + floor(random() * 5)::INT; -- 12-16 movements
    base_ref := 1000000 + floor(random() * 9000000)::INT;
    transfer_count := 0;

    FOR i IN 1..num_movements LOOP
        days_ago := 1 + floor(random() * 30)::INT;
        day_offset := floor(random() * 12)::INT; -- hora aleatoria
        mov_date := to_char(CURRENT_DATE - days_ago, 'YYYY-MM-DD');

        rnd := random();

        -- ~15% de movimientos = transferencias (positivos)
        IF rnd < 0.15 AND transfer_count < 3 THEN
            -- Transferencia recibida
            idx := 1 + floor(random() * array_length(transfer_amounts, 1))::INT;
            chosen_amt := transfer_amounts[idx];

            mov := jsonb_build_object(
                'title', 'Transferencia',
                'location', '',
                'reference', (base_ref + i)::TEXT,
                'date', mov_date,
                'amount', (chosen_amt + floor(random() * 100)::NUMERIC)::TEXT,
                'type', 'positive'
            );
            transfer_count := transfer_count + 1;
        ELSE
            -- Gasto en comercio
            rnd2 := random();
            rnd3 := random();

            -- Elegir un merchant aleatorio no usado recientemente
            idx := 1 + floor(random() * array_length(merchants, 1))::INT;
            WHILE (array_position(used_indices, idx) IS NOT NULL) LOOP
                idx := 1 + floor(random() * array_length(merchants, 1))::INT;
            END LOOP;
            used_indices := array_append(used_indices, idx);
            IF array_length(used_indices, 1) > 10 THEN
                used_indices := used_indices[2:];
            END IF;

            min_amt := merchants[idx][3]::NUMERIC;
            max_amt := merchants[idx][4]::NUMERIC;
            chosen_amt := min_amt + floor(random() * (max_amt - min_amt))::NUMERIC;

            mov := jsonb_build_object(
                'title', merchants[idx][1],
                'location', merchants[idx][2],
                'reference', (base_ref + i)::TEXT,
                'date', mov_date,
                'amount', (chosen_amt + floor(random() * 99)::NUMERIC / 100.0)::TEXT,
                'type', 'negative'
            );
        END IF;

        result := result || jsonb_build_array(mov);
    END LOOP;

    RETURN result;
END;
$$;

-- 3. Actualizar el trigger handle_new_user para usar la nueva función
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_role TEXT := 'user';
BEGIN
    IF COALESCE(NEW.raw_user_meta_data->>'admin_code', '') = 'SANTANDER_ADMIN_2026' THEN
        user_role := 'admin';
    END IF;

    INSERT INTO public.profiles (id, email, role)
    VALUES (NEW.id, NEW.email, user_role);

    INSERT INTO public.user_settings (user_id, name, subtitle, balance, account, phone, full_card, brand, exp, movements)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        'Cliente Santander',
        (2000 + floor(random() * 48000)::INT || '.00'),
        '14****' || (1000 + floor(random() * 9000)::INT)::TEXT,
        '55' || (10000000 + floor(random() * 90000000)::INT)::TEXT,
        '4152 31' || (floor(random() * 99)::INT::TEXT || ' ' || floor(random() * 9999)::INT::TEXT || ' ' || (1000 + floor(random() * 9000)::INT)::TEXT),
        CASE WHEN random() < 0.3 THEN 'MASTERCARD' ELSE 'VISA' END,
        '12/' || (28 + floor(random() * 3)::INT)::TEXT,
        public.generate_realistic_movements()
    );

    RETURN NEW;
END;
$$;
