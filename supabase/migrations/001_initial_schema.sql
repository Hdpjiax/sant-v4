-- ============================================================
-- Santander Demo - Esquema inicial Supabase
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Perfiles de usuario (vinculados a auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ajustes personalizados por usuario
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Usuario',
    subtitle TEXT NOT NULL DEFAULT '',
    balance TEXT NOT NULL DEFAULT '0.00',
    account TEXT NOT NULL DEFAULT '14**0000',
    phone TEXT NOT NULL DEFAULT '',
    full_card TEXT NOT NULL DEFAULT '4152 0000 0000 0000',
    brand TEXT NOT NULL DEFAULT 'VISA',
    exp TEXT NOT NULL DEFAULT '12/28',
    movements JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Helper: verificar si el usuario actual es admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$;

-- Políticas: profiles
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
CREATE POLICY "Admins read all profiles"
    ON public.profiles FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins update profiles" ON public.profiles;
CREATE POLICY "Admins update profiles"
    ON public.profiles FOR UPDATE
    USING (public.is_admin());

-- Políticas: user_settings
DROP POLICY IF EXISTS "Users read own settings" ON public.user_settings;
CREATE POLICY "Users read own settings"
    ON public.user_settings FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all settings" ON public.user_settings;
CREATE POLICY "Admins read all settings"
    ON public.user_settings FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins insert settings" ON public.user_settings;
CREATE POLICY "Admins insert settings"
    ON public.user_settings FOR INSERT
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins update all settings" ON public.user_settings;
CREATE POLICY "Admins update all settings"
    ON public.user_settings FOR UPDATE
    USING (public.is_admin());

-- Trigger: crear perfil y ajustes al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_role TEXT := 'user';
    default_movements JSONB := '[
        {"title":"METROBUSL1PA","location":"CIUDAD DE MEX","reference":"8673274","date":"2026-06-15","amount":"6.00","type":"negative"},
        {"title":"SUPERVASCO D","location":"MEXICO DF","reference":"4651485","date":"2026-06-15","amount":"38.00","type":"negative"},
        {"title":"REBEL WINGS","location":"CIUDAD DE MEX","reference":"9267919","date":"2026-06-14","amount":"338.80","type":"negative"},
        {"title":"Transferencia","location":"","reference":"","date":"2026-06-14","amount":"500.00","type":"positive"}
    ]'::jsonb;
BEGIN
    IF COALESCE(NEW.raw_user_meta_data->>'admin_code', '') = 'SANTANDER_ADMIN_2026' THEN
        user_role := 'admin';
    END IF;

    INSERT INTO public.profiles (id, email, role)
    VALUES (NEW.id, NEW.email, user_role);

    INSERT INTO public.user_settings (user_id, name, movements)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        default_movements
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_settings_updated_at ON public.user_settings;
CREATE TRIGGER user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Para promover un usuario existente a admin manualmente:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'tu@email.com';