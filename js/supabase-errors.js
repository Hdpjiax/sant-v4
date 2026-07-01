window.formatSupabaseError = function (error) {
    if (!error) return "Ocurrió un error inesperado.";

    const msg = String(error.message || error.msg || error).toLowerCase();

    if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("load failed")) {
        if (window.location.protocol === "file:") {
            return "Estás abriendo el HTML directamente (file://). Ejecuta npm run dev:local y usa http://localhost:3000";
        }
        return "No se pudo conectar con Supabase. Usa http://localhost:3000 (npm run dev:local), verifica tu internet y js/config.js.";
    }

    if (msg.includes("invalid api key")) {
        return "La API key de Supabase no es válida. Revisa js/config.js o las variables de entorno en Vercel.";
    }

    if (msg.includes("tu_proyecto") || msg.includes("tu_anon")) {
        return "Supabase no está configurado. Edita js/config.js con tu URL y anon key reales.";
    }

    if (error.code === "PGRST116" || msg.includes("0 rows")) {
        return "Tu cuenta existe pero no tiene perfil. Ejecuta la migración SQL en Supabase o contacta al administrador.";
    }

    if (msg.includes("email not confirmed")) {
        return "Confirma tu correo antes de iniciar sesión, o desactiva la confirmación en Supabase → Authentication.";
    }

    if (msg.includes("invalid login credentials")) {
        return "Correo o contraseña incorrectos.";
    }

    if (msg.includes("user already registered")) {
        return "Este correo ya está registrado. Inicia sesión.";
    }

    return error.message || error.msg || "Error de conexión con el servidor.";
};