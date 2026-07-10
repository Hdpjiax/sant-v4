-- ============================================================
-- Santander Demo - Migración 003
-- Agrega columna product a user_settings
-- ============================================================

ALTER TABLE IF EXISTS public.user_settings
    ADD COLUMN IF NOT EXISTS product TEXT NOT NULL DEFAULT '';
