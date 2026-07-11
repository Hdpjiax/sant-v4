document.addEventListener("DOMContentLoaded", async () => {
    try {
        window.ensureSupabaseReady();
    } catch (error) {
        document.body.innerHTML = `<main class="admin-container"><div class="admin-empty">${window.formatSupabaseError(error)}</div></main>`;
        return;
    }

    let auth;
    try {
        auth = await window.SantanderAuth.requireAdmin();
    } catch (error) {
        document.body.innerHTML = `<main class="admin-container"><div class="admin-empty">${window.formatSupabaseError(error)}</div></main>`;
        return;
    }
    if (!auth) return;

    const { profile } = auth;
    const emailEl = document.getElementById("admin-email");
    const tableBody = document.getElementById("users-table-body");
    const editModal = document.getElementById("edit-modal");
    const movsList = document.getElementById("edit-movements-list");

    if (emailEl) emailEl.textContent = profile.email;

    document.getElementById("btn-logout")?.addEventListener("click", () => {
        window.SantanderAuth.signOut();
    });

    document.getElementById("btn-go-app")?.addEventListener("click", () => {
        window.location.href = "index.html";
    });

    document.getElementById("btn-close-modal")?.addEventListener("click", () => {
        editModal?.classList.remove("active");
    });

    function formatCardInput(input) {
        if (!input) return;
        input.addEventListener("input", () => {
            let val = input.value.replace(/\D/g, "").slice(0, 16);
            input.value = val.replace(/(.{4})/g, "$1 ").trim();
        });
    }
    formatCardInput(document.getElementById("edit-full-card"));

    editModal?.addEventListener("click", (e) => {
        if (e.target === editModal) editModal.classList.remove("active");
    });

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function showToast(msg) {
        const toast = document.getElementById("admin-toast");
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.add("visible");
        setTimeout(() => toast.classList.remove("visible"), 2800);
    }

    function formatDate(dateStr) {
        if (!dateStr) return "—";
        const d = new Date(dateStr);
        return d.toLocaleDateString("es-MX", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    let adminMovsPage = 0;
    const ADMIN_MOVS_PAGE_SIZE = 20;
    let adminMovsCache = [];

    function addMovRow(mov = {}) {
        window.SantanderMovUtils.addMovRow(movsList, mov);
    }

    function collectMovements() {
        return window.SantanderMovUtils.collectMovements("edit-movements-list");
    }

    function loadMoreMovs() {
        adminMovsPage++;
        const start = adminMovsPage * ADMIN_MOVS_PAGE_SIZE;
        const slice = adminMovsCache.slice(start, start + ADMIN_MOVS_PAGE_SIZE);
        slice.forEach(m => addMovRow(m));

        const moreBtn = document.getElementById("btn-admin-more-movs");
        const hasMore = adminMovsCache.length > (adminMovsPage + 1) * ADMIN_MOVS_PAGE_SIZE;
        if (hasMore) {
            if (!moreBtn) {
                const btn = document.createElement("button");
                btn.id = "btn-admin-more-movs";
                btn.className = "btn-outline";
                btn.textContent = "Ver más movimientos";
                btn.style.cssText = "margin:8px auto;display:block;max-width:200px;padding:10px;font-size:13px;";
                btn.addEventListener("click", loadMoreMovs);
                movsList?.parentNode?.appendChild(btn);
            }
        } else {
            moreBtn?.remove();
        }
    }

    function openEditModal(userId, email, settings) {
        document.getElementById("edit-user-id").value = userId;
        document.getElementById("edit-user-email").textContent = email;
        document.getElementById("edit-name").value = settings.name || "";
        document.getElementById("edit-subtitle").value = settings.subtitle || "";
        document.getElementById("edit-balance").value = settings.balance || "0.00";
        document.getElementById("edit-account").value = settings.account || "";
        document.getElementById("edit-phone").value = settings.phone || "";
        document.getElementById("edit-full-card").value = settings.full_card || "";
        document.getElementById("edit-brand").value = settings.brand || "VISA";
        document.getElementById("edit-exp").value = settings.exp || "12/28";

        if (movsList) movsList.innerHTML = "";
        adminMovsPage = 0;
        adminMovsCache = settings.movements || [];
        const initialSlice = adminMovsCache.slice(0, ADMIN_MOVS_PAGE_SIZE);
        initialSlice.forEach(m => addMovRow(m));

        document.getElementById("btn-admin-more-movs")?.remove();

        if (adminMovsCache.length > ADMIN_MOVS_PAGE_SIZE) {
            const btn = document.createElement("button");
            btn.id = "btn-admin-more-movs";
            btn.className = "btn-outline";
            btn.textContent = "Ver más movimientos";
            btn.style.cssText = "margin:8px auto;display:block;max-width:200px;padding:10px;font-size:13px;";
            btn.addEventListener("click", loadMoreMovs);
            movsList?.parentNode?.appendChild(btn);
        }

        editModal?.classList.add("active");
    }

    async function loadUsers() {
        try {
            const users = await window.SettingsService.getAllUsersWithSettings();

            document.getElementById("stat-total").textContent = users.length;
            document.getElementById("stat-admins").textContent = users.filter(u => u.profile.role === "admin").length;

            if (!users.length) {
                tableBody.innerHTML = '<tr><td colspan="6" class="admin-empty">No hay usuarios registrados aún.</td></tr>';
                return;
            }

            tableBody.innerHTML = users.map(({ profile: p, settings: s }) => `
                <tr>
                    <td><strong>${escapeHtml(s?.name || "—")}</strong></td>
                    <td>${escapeHtml(p.email)}</td>
                    <td>
                        <span class="admin-badge ${p.role === "admin" ? "admin-badge-admin" : "admin-badge-user"}">
                            ${p.role === "admin" ? "Admin" : "Usuario"}
                        </span>
                    </td>
                    <td>$${escapeHtml(s?.balance || "0.00")}</td>
                    <td>${formatDate(s?.updated_at)}</td>
                    <td>
                        <button class="admin-edit-btn" data-user-id="${p.id}" data-email="${escapeHtml(p.email)}">
                            Editar ajustes
                        </button>
                    </td>
                </tr>
            `).join("");

            tableBody.querySelectorAll(".admin-edit-btn").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const userId = btn.dataset.userId;
                    const email = btn.dataset.email;

                    try {
                        const settings = await window.SettingsService.getSettingsByUserId(userId);
                        openEditModal(userId, email, settings);
                    } catch (err) {
                        showToast("Error al cargar ajustes: " + err.message);
                    }
                });
            });
        } catch (err) {
            tableBody.innerHTML = `<tr><td colspan="6" class="admin-empty">Error: ${escapeHtml(window.formatSupabaseError(err))}</td></tr>`;
        }
    }

    document.getElementById("btn-add-mov-row")?.addEventListener("click", () => {
        const today = new Date().toISOString().split("T")[0];
        addMovRow({
            title: "NUEVO ESTABLECIMIENTO",
            date: today,
            amount: "100.00",
            type: "negative",
            location: "CIUDAD DE MEX",
            reference: "0000000"
        });
    });

    document.getElementById("btn-save-settings")?.addEventListener("click", async () => {
        const userId = document.getElementById("edit-user-id").value;
        const saveBtn = document.getElementById("btn-save-settings");

        const v = window.SantanderMovUtils;
        const fullCard = document.getElementById("edit-full-card").value.trim();
        if (fullCard && !v.validateLuhn(fullCard)) {
            showToast("Número de tarjeta inválido (Luhn).");
            return;
        }

        const exp = document.getElementById("edit-exp").value.trim();
        if (exp && !v.validateExpDate(exp)) {
            showToast("Fecha de expiración inválida o vencida.");
            return;
        }

        const account = document.getElementById("edit-account").value.trim();
        const balance = document.getElementById("edit-balance").value.trim();
        if (balance && !v.validateAmount(balance)) {
            showToast("Monto inválido. Usa hasta 2 decimales.");
            return;
        }

        const payload = {
            name: document.getElementById("edit-name").value.trim(),
            subtitle: document.getElementById("edit-subtitle").value.trim(),
            balance: balance,
            account: account,
            phone: document.getElementById("edit-phone").value.trim(),
            full_card: fullCard,
            brand: document.getElementById("edit-brand").value,
            exp: exp,
            movements: collectMovements()
        };

        saveBtn.disabled = true;
        saveBtn.textContent = "Guardando...";

        try {
            await window.SettingsService.updateUserSettings(userId, payload);
            editModal?.classList.remove("active");
            showToast("Ajustes guardados correctamente");
            await loadUsers();
        } catch (err) {
            showToast("Error al guardar: " + err.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = "Guardar cambios";
        }
    });

    await loadUsers();
});