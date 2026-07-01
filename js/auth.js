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

    async requireSession(redirectTo = "login.html") {
        try {
            const session = await this.getSession();
            if (!session) {
                window.location.href = redirectTo;
                return null;
            }
            return session;
        } catch (error) {
            console.error("Error de sesión:", error);
            throw error;
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
        const { error } = await sb.auth.signOut();
        if (error) throw error;
        window.location.href = "login.html";
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