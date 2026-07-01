(function () {
    if (!window.supabase) {
        console.error("Supabase JS no cargado. Incluye el CDN antes de este script.");
        return;
    }

    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
        console.error("Faltan SUPABASE_URL o SUPABASE_ANON_KEY en js/config.js");
        return;
    }

    if (window.SUPABASE_URL.includes("TU_PROYECTO") || window.SUPABASE_ANON_KEY.includes("TU_ANON")) {
        console.warn("Configura js/config.js con tus credenciales reales de Supabase.");
    }

    window.sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
})();