window.SettingsService = {
    DEFAULT_MOVEMENTS: [
        {
            title: "METROBUSL1PA",
            location: "CIUDAD DE MEX",
            reference: "8673274",
            date: "2026-06-15",
            amount: "6.00",
            type: "negative"
        },
        {
            title: "SUPERVASCO D",
            location: "MEXICO DF",
            reference: "4651485",
            date: "2026-06-15",
            amount: "38.00",
            type: "negative"
        },
        {
            title: "REBEL WINGS",
            location: "CIUDAD DE MEX",
            reference: "9267919",
            date: "2026-06-14",
            amount: "338.80",
            type: "negative"
        },
        {
            title: "Transferencia",
            location: "",
            reference: "",
            date: "2026-06-14",
            amount: "500.00",
            type: "positive"
        }
    ],

    normalize(settings) {
        if (!settings) return null;

        let movements = settings.movements;
        if (typeof movements === "string") {
            try {
                movements = JSON.parse(movements);
            } catch {
                movements = this.DEFAULT_MOVEMENTS;
            }
        }

        if (!Array.isArray(movements) || movements.length === 0) {
            movements = this.DEFAULT_MOVEMENTS;
        }

        return {
            id: settings.id,
            user_id: settings.user_id,
            name: settings.name || "Usuario",
            subtitle: settings.subtitle || "",
            balance: settings.balance || "0.00",
            account: settings.account || "14**0000",
            phone: settings.phone || "",
            product: settings.product || "",
            full_card: settings.full_card || "4152 0000 0000 0000",
            brand: settings.brand || "VISA",
            exp: settings.exp || "12/28",
            movements,
            updated_at: settings.updated_at
        };
    },

    _client() {
        return window.ensureSupabaseReady();
    },

    async getMySettings() {
        const session = await window.SantanderAuth.getSession();
        if (!session) return null;

        const { data, error } = await this._client()
            .from("user_settings")
            .select("*")
            .eq("user_id", session.user.id)
            .single();

        if (error) throw error;
        return this.normalize(data);
    },

    async getAllUsersWithSettings() {
        const { data: profiles, error: profilesError } = await this._client()
            .from("profiles")
            .select("id, email, role, created_at")
            .order("created_at", { ascending: false });

        if (profilesError) throw profilesError;

        const { data: allSettings, error: settingsError } = await this._client()
            .from("user_settings")
            .select("*");

        if (settingsError) throw settingsError;

        const settingsMap = {};
        (allSettings || []).forEach(s => {
            settingsMap[s.user_id] = this.normalize(s);
        });

        return (profiles || []).map(profile => ({
            profile,
            settings: settingsMap[profile.id] || null
        }));
    },

    async getSettingsByUserId(userId) {
        const { data, error } = await this._client()
            .from("user_settings")
            .select("*")
            .eq("user_id", userId)
            .single();

        if (error) throw error;
        return this.normalize(data);
    },

    async updateUserSettings(userId, payload) {
        const updateData = {
            name: payload.name,
            subtitle: payload.subtitle,
            balance: payload.balance,
            account: payload.account,
            phone: payload.phone,
            full_card: payload.full_card,
            brand: payload.brand,
            exp: payload.exp,
            movements: payload.movements
        };

        const { data, error } = await this._client()
            .from("user_settings")
            .update(updateData)
            .eq("user_id", userId)
            .select()
            .single();

        if (error) throw error;
        return this.normalize(data);
    }
};
