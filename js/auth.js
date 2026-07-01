window.SantanderAuth = {
    async getSession() {
        const { data, error } = await window.sb.auth.getSession();
        if (error) throw error;
        return data.session;
    },

    async requireSession(redirectTo = "login.html") {
        const session = await this.getSession();
        if (!session) {
            window.location.href = redirectTo;
            return null;
        }
        return session;
    },

    async getProfile() {
        const session = await this.getSession();
        if (!session) return null;

        const { data, error } = await window.sb
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
        const metadata = { display_name: displayName };

        if (adminCode && adminCode === window.ADMIN_REGISTRATION_CODE) {
            metadata.admin_code = adminCode;
        }

        const { data, error } = await window.sb.auth.signUp({
            email,
            password,
            options: { data: metadata }
        });

        if (error) throw error;
        return data;
    },

    async signIn(email, password) {
        const { data, error } = await window.sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    },

    async signOut() {
        const { error } = await window.sb.auth.signOut();
        if (error) throw error;
        window.location.href = "login.html";
    }
};