-- ============================================================
-- Santander Demo - Migración 004
-- Restringe la actualización de ajustes únicamente a administradores
-- ============================================================

DROP POLICY IF EXISTS "Users update own settings" ON public.user_settings;
