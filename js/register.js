document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("register-form");
    const errorEl = document.getElementById("auth-error");
    const successEl = document.getElementById("auth-success");
    const submitBtn = document.getElementById("btn-register");

    const session = await window.SantanderAuth.getSession();
    if (session) {
        const profile = await window.SantanderAuth.getProfile();
        window.location.href = profile?.role === "admin" ? "admin.html" : "index.html";
        return;
    }

    function showError(msg) {
        errorEl.textContent = msg;
        errorEl.classList.add("visible");
        successEl.classList.remove("visible");
    }

    function showSuccess(msg) {
        successEl.textContent = msg;
        successEl.classList.add("visible");
        errorEl.classList.remove("visible");
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const displayName = document.getElementById("display-name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirm-password").value;
        const adminCode = document.getElementById("admin-code").value.trim();

        errorEl.classList.remove("visible");
        successEl.classList.remove("visible");

        if (password !== confirmPassword) {
            showError("Las contraseñas no coinciden.");
            return;
        }

        if (password.length < 6) {
            showError("La contraseña debe tener al menos 6 caracteres.");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Registrando...";

        try {
            const result = await window.SantanderAuth.signUp(email, password, displayName, adminCode);

            if (result.session) {
                const profile = await window.SantanderAuth.getProfile();
                window.location.href = profile?.role === "admin" ? "admin.html" : "index.html";
                return;
            }

            showSuccess("Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.");
            setTimeout(() => {
                window.location.href = "login.html";
            }, 2500);
        } catch (err) {
            showError(err.message || "Error al registrarse. Intenta de nuevo.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Registrarse";
        }
    });
});