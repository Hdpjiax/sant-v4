document.addEventListener("DOMContentLoaded", async () => {
    const auth = await window.SantanderAuth.requireAdmin();
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

    function addMovRow(mov = {}) {
        const row = document.createElement("div");
        row.className = "config-mov-row";
        row.innerHTML = `
            <input type="text" placeholder="Establecimiento" value="${escapeHtml(mov.title || "")}" style="margin-bottom:4px;">
            <div class="config-mov-row-inputs">
                <input type="text" placeholder="Lugar" value="${escapeHtml(mov.location || "")}" style="flex:1;">
                <input type="text" placeholder="Referencia" value="${escapeHtml(mov.reference || "")}" style="flex:1;">
            </div>
            <div class="config-mov-row-inputs">
                <input type="date" value="${escapeHtml(mov.date || "")}" style="flex:1.5;">
                <input type="text" placeholder="Monto" value="${escapeHtml(mov.amount || "")}" style="flex:1;">
                <select style="flex:0.8;">
                    <option value="negative" ${mov.type === "negative" ? "selected" : ""}>-</option>
                    <option value="positive" ${mov.type === "positive" ? "selected" : ""}>+</option>
                </select>
                <button type="button" class="btn-del-mov">X</button>
            </div>
        `;

        row.querySelector(".btn-del-mov")?.addEventListener("click", () => row.remove());
        movsList?.appendChild(row);
    }

    function collectMovements() {
        return Array.from(document.querySelectorAll("#edit-movements-list .config-mov-row")).map(r => {
            const inputs = r.querySelectorAll("input");
            const select = r.querySelector("select");
            return {
                title: inputs[0]?.value.trim() || "Establecimiento",
                location: inputs[1]?.value.trim() || "",
                reference: inputs[2]?.value.trim() || "",
                date: inputs[3]?.value || "",
                amount: inputs[4]?.value.trim() || "0.00",
                type: select?.value || "negative"
            };
        });
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
        (settings.movements || []).forEach(m => addMovRow(m));

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
            tableBody.innerHTML = `<tr><td colspan="6" class="admin-empty">Error: ${escapeHtml(err.message)}</td></tr>`;
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

        const payload = {
            name: document.getElementById("edit-name").value.trim(),
            subtitle: document.getElementById("edit-subtitle").value.trim(),
            balance: document.getElementById("edit-balance").value.trim(),
            account: document.getElementById("edit-account").value.trim(),
            phone: document.getElementById("edit-phone").value.trim(),
            full_card: document.getElementById("edit-full-card").value.trim(),
            brand: document.getElementById("edit-brand").value,
            exp: document.getElementById("edit-exp").value.trim(),
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