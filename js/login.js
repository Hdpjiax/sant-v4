document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("login-form");
    const errorEl = document.getElementById("auth-error");
    const submitBtn = document.getElementById("btn-login");

    const session = await window.SantanderAuth.getSession();
    if (session) {
        const profile = await window.SantanderAuth.getProfile();
        window.location.href = profile?.role === "admin" ? "admin.html" : "index.html";
        return;
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        errorEl.classList.remove("visible");
        submitBtn.disabled = true;
        submitBtn.textContent = "Entrando...";

        try {
            await window.SantanderAuth.signIn(email, password);
            const profile = await window.SantanderAuth.getProfile();

            if (profile?.role === "admin") {
                window.location.href = "admin.html";
            } else {
                window.location.href = "index.html";
            }
        } catch (err) {
            errorEl.textContent = err.message || "Credenciales incorrectas.";
            errorEl.classList.add("visible");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Entrar";
        }
    });
});