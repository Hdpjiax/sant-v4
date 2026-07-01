(function () {
    function isConfigValid() {
        const url = window.SUPABASE_URL || "";
        const key = window.SUPABASE_ANON_KEY || "";

        if (!url || !key) return false;
        if (url.includes("TU_PROYECTO") || key.includes("TU_ANON")) return false;
        if (!url.startsWith("https://") || !url.includes(".supabase.co")) return false;

        return true;
    }

    window.isSupabaseReady = function () {
        return Boolean(window.sb && isConfigValid());
    };

    window.ensureSupabaseReady = function () {
        if (!window.supabase) {
            throw new Error("La librería de Supabase no cargó. Revisa tu conexión o recarga la página.");
        }

        if (!isConfigValid()) {
            throw new Error("Supabase no está configurado. Edita js/config.js (local) o las variables SUPABASE_URL y SUPABASE_ANON_KEY en Vercel.");
        }

        if (!window.sb) {
            throw new Error("El cliente de Supabase no se inicializó. Revisa la configuración.");
        }

        return window.sb;
    };

    if (!window.supabase) {
        console.error("Supabase JS no cargado. Incluye el CDN antes de este script.");
        return;
    }

    if (!isConfigValid()) {
        console.error("Configura SUPABASE_URL y SUPABASE_ANON_KEY en js/config.js o variables de entorno.");
        return;
    }

    try {
        window.sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
    } catch (error) {
        console.error("Error al crear cliente Supabase:", error);
    }
})();