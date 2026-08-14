/**
 * Santander Auth Service
 */
window.SantanderAuth = {
    _client() {
        return window.ensureSupabaseReady();
    },

    async getSession() {
        const sb = this._client();
        const { data, error } = await sb.auth.getSession();
        if (error) throw error;
        return data.session;
    },

    async requireSession(redirectTo = null) {
        try {
            const session = await this.getSession();
            if (!session) {
                let target = redirectTo;
                if (!target) {
                    const hasRemembered = !!localStorage.getItem("santander_last_user");
                    target = hasRemembered ? "login.html" : "register.html";
                }
                window.location.href = target;
                return null;
            }
            return session;
        } catch (error) {
            console.error("Error de sesión:", error);
            const hasRemembered = !!localStorage.getItem("santander_last_user");
            window.location.href = redirectTo || (hasRemembered ? "login.html" : "register.html");
            return null;
        }
    },

    async getProfile() {
        const session = await this.getSession();
        if (!session) return null;

        const sb = this._client();
        const { data, error } = await sb
            .from("profiles")
            .select("id, email, role, created_at")
            .eq("id", session.user.id)
            .single();

        if (error) throw error;
        return data;
    },

    async requireAdmin(redirectTo = "login.html") {
        const session = await this.requireSession(redirectTo);
        if (!session) return null;

        const profile = await this.getProfile();
        if (!profile || profile.role !== "admin") {
            window.location.href = "index.html";
            return null;
        }

        return { session, profile };
    },

    async signUp(email, password, displayName, adminCode) {
        const sb = this._client();
        const metadata = { display_name: displayName };

        if (adminCode && adminCode === window.ADMIN_REGISTRATION_CODE) {
            metadata.admin_code = adminCode;
        }

        const { data, error } = await sb.auth.signUp({
            email,
            password,
            options: { data: metadata }
        });

        if (error) throw error;
        return data;
    },

    async signIn(email, password) {
        const sb = this._client();
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    },

    async signOut() {
        const sb = this._client();
        try {
            await sb.auth.signOut();
        } catch (e) {
            console.warn("SignOut warning:", e);
        }
        const hasRemembered = !!localStorage.getItem("santander_last_user");
        window.location.href = hasRemembered ? "login.html" : "register.html";
    },

    async updateProfile(displayName) {
        const sb = this._client();
        const { data, error } = await sb.auth.updateUser({
            data: { display_name: displayName }
        });
        if (error) throw error;
        return data;
    },

    async testConnection() {
        this._client();
        const response = await fetch(`${window.SUPABASE_URL}/auth/v1/health`, {
            method: "GET",
            headers: { apikey: window.SUPABASE_ANON_KEY }
        });
        return response.ok;
    }
};
