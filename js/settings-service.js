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

    generateRealisticMovements() {
        const merchants = [
            { title: "METROBUSL1PA", location: "CIUDAD DE MEX", min: 6, max: 6 },
            { title: "SUPERVASCO D", location: "MEXICO DF", min: 38, max: 185 },
            { title: "REBEL WINGS", location: "CIUDAD DE MEX", min: 180, max: 450 },
            { title: "UBER *VIAJE", location: "CDMX", min: 45, max: 180 },
            { title: "DIDI FOOD", location: "MEXICO", min: 89, max: 320 },
            { title: "CINEPOLIS", location: "CIUDAD DE MEX", min: 89, max: 250 },
            { title: "FARMACIA GUADALAJARA", location: "CDMX", min: 120, max: 850 },
            { title: "WALMART", location: "MEXICO DF", min: 350, max: 2500 },
            { title: "SORIANA", location: "CDMX", min: 180, max: 1200 },
            { title: "HEB", location: "CIUDAD DE MEX", min: 250, max: 1800 },
            { title: "SAMS CLUB", location: "MEXICO DF", min: 600, max: 3500 },
            { title: "COSTCO", location: "CIUDAD DE MEX", min: 500, max: 4000 },
            { title: "NETFLIX", location: "MEXICO", min: 139, max: 299 },
            { title: "SPOTIFY", location: "MEXICO", min: 129, max: 129 },
            { title: "AMAZON MX", location: "CIUDAD DE MEX", min: 150, max: 3500 },
            { title: "MERCADO LIBRE", location: "CDMX", min: 200, max: 2800 },
            { title: "SHELL GAS", location: "MEXICO DF", min: 500, max: 1200 },
            { title: "PEMEX", location: "CIUDAD DE MEX", min: 400, max: 1000 },
            { title: "STARBUCKS", location: "MEXICO DF", min: 65, max: 180 },
            { title: "LA COMER", location: "CIUDAD DE MEX", min: 300, max: 1500 },
            { title: "CITY CLUB", location: "MEXICO DF", min: 400, max: 2000 },
            { title: "MOVISTAR", location: "CDMX", min: 299, max: 899 },
            { title: "TELCEL", location: "MEXICO", min: 200, max: 500 },
            { title: "CFE", location: "CIUDAD DE MEX", min: 350, max: 1200 },
            { title: "ZARA", location: "MEXICO DF", min: 400, max: 2500 }
        ];
        const transferAmounts = [500, 1000, 1500, 2000, 2500, 3000, 4000, 5000];
        const movements = [];
        const count = 12 + Math.floor(Math.random() * 5);
        const baseRef = 1000000 + Math.floor(Math.random() * 9000000);
        const usedIndices = new Set();
        let transferCount = 0;

        for (let i = 0; i < count; i++) {
            const daysAgo = 1 + Math.floor(Math.random() * 30);
            const d = new Date();
            d.setDate(d.getDate() - daysAgo);
            const dateStr = d.toISOString().split("T")[0];

            if (Math.random() < 0.15 && transferCount < 3) {
                const idx = Math.floor(Math.random() * transferAmounts.length);
                const amt = (transferAmounts[idx] + Math.floor(Math.random() * 100)) / 1;
                movements.push({
                    title: "Transferencia",
                    location: "",
                    reference: String(baseRef + i),
                    date: dateStr,
                    amount: amt.toFixed(2),
                    type: "positive"
                });
                transferCount++;
            } else {
                let idx = Math.floor(Math.random() * merchants.length);
                let attempts = 0;
                while (usedIndices.has(idx) && attempts < 20) {
                    idx = Math.floor(Math.random() * merchants.length);
                    attempts++;
                }
                usedIndices.add(idx);
                if (usedIndices.size > 10) {
                    const first = usedIndices.values().next().value;
                    usedIndices.delete(first);
                }

                const m = merchants[idx];
                const amt = m.min + Math.floor(Math.random() * (m.max - m.min)) + Math.floor(Math.random() * 99) / 100;
                movements.push({
                    title: m.title,
                    location: m.location,
                    reference: String(baseRef + i),
                    date: dateStr,
                    amount: amt.toFixed(2),
                    type: "negative"
                });
            }
        }

        return movements;
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

    async updateMySettings(payload) {
        const session = await window.SantanderAuth.getSession();
        if (!session) throw new Error("No hay sesión activa");

        const buildUpdate = (data) => {
            const u = {};
            if (data.name !== undefined) u.name = data.name;
            if (data.subtitle !== undefined) u.subtitle = data.subtitle;
            if (data.phone !== undefined) u.phone = data.phone;
            if (data.balance !== undefined) u.balance = data.balance;
            if (data.account !== undefined) u.account = data.account;
            if (data.full_card !== undefined) u.full_card = data.full_card;
            if (data.brand !== undefined) u.brand = data.brand;
            if (data.exp !== undefined) u.exp = data.exp;
            if (data.product !== undefined) u.product = data.product;
            if (data.movements !== undefined) u.movements = data.movements;
            return u;
        };

        const tryUpdate = (updateData) => this._client()
            .from("user_settings")
            .update(updateData)
            .eq("user_id", session.user.id)
            .select()
            .single();

        let updateData = buildUpdate(payload);
        let { data, error } = await tryUpdate(updateData);

        if (error && error.message && error.message.includes("column") && updateData.product !== undefined) {
            delete updateData.product;
            ({ data, error } = await tryUpdate(updateData));
        }

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
