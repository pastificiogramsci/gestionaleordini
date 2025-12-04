// ============================================
// 💾 GESTIONE STORAGE (localStorage + Dropbox)
// ============================================

const Storage = {

    dropboxClient: null,
    dropboxAccessToken: null,
    dropboxRefreshToken: null,
    autoSyncInterval: null,

    // ==========================================
    // INIZIALIZZAZIONE DROPBOX
    // ==========================================

    async initDropbox() {
        this.dropboxAccessToken = localStorage.getItem('dropboxAccessToken');
        this.dropboxRefreshToken = localStorage.getItem('dropboxRefreshToken');

        if (this.dropboxAccessToken) {
            this.dropboxClient = new Dropbox.Dropbox({
                accessToken: this.dropboxAccessToken
            });

            this.startAutoSync();
        }

        await this.checkDropboxCallback();
    },

    startDropboxAuth() {
        const config = CONFIG.getDropboxConfig();
        const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${config.clientId}&response_type=code&redirect_uri=${encodeURIComponent(config.redirectUri)}&token_access_type=offline`;
        window.location.href = authUrl;
    },

    async checkDropboxCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (code) {
            try {
                const config = CONFIG.getDropboxConfig();
                const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        code: code,
                        grant_type: 'authorization_code',
                        client_id: config.clientId,
                        client_secret: config.clientSecret,
                        redirect_uri: config.redirectUri
                    })
                });

                const data = await response.json();

                if (data.access_token) {
                    this.dropboxAccessToken = data.access_token;
                    localStorage.setItem('dropboxAccessToken', data.access_token);

                    if (data.refresh_token) {
                        this.dropboxRefreshToken = data.refresh_token;
                        localStorage.setItem('dropboxRefreshToken', data.refresh_token);
                        console.log("✅ Refresh token salvato");
                    }

                    this.dropboxClient = new Dropbox.Dropbox({
                        accessToken: this.dropboxAccessToken
                    });

                    Utils.showToast("✅ Dropbox connesso!", "success");
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            } catch (error) {
                console.error("Errore auth Dropbox:", error);
                Utils.showToast("Errore connessione Dropbox", "error");
            }
        }
    },

    async refreshAccessToken() {
        console.log("🔄 Rinnovo access token...");

        if (!this.dropboxRefreshToken) {
            console.warn("⚠️ Nessun refresh token disponibile");
            return null;
        }

        try {
            const config = CONFIG.getDropboxConfig();
            const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    grant_type: "refresh_token",
                    refresh_token: this.dropboxRefreshToken,
                    client_id: config.clientId,
                    client_secret: config.clientSecret
                })
            });

            if (!response.ok) {
                console.error("❌ Errore rinnovo token");
                return null;
            }

            const data = await response.json();

            if (!data.access_token) {
                console.error("❌ Nessun token nella risposta");
                return null;
            }

            this.dropboxAccessToken = data.access_token;
            localStorage.setItem("dropboxAccessToken", data.access_token);

            if (data.refresh_token) {
                this.dropboxRefreshToken = data.refresh_token;
                localStorage.setItem("dropboxRefreshToken", data.refresh_token);
            }

            this.dropboxClient = new Dropbox.Dropbox({
                accessToken: this.dropboxAccessToken
            });

            console.log("✅ Token rinnovato con successo");
            return data.access_token;

        } catch (err) {
            console.error("❌ Errore rinnovo token:", err);
            return null;
        }
    },

    startAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
        }

        this.autoSyncInterval = setInterval(() => {
            this.syncAllToDropbox(true);
        }, 5 * 60 * 1000);

        console.log("✅ Auto-sync attivato (ogni 5 minuti)");
    },

    stopAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
            console.log("⏸️ Auto-sync disattivato");
        }
    },

    async syncAllToDropbox(silent = false) {
        if (!this.dropboxClient) {
            if (!silent) console.log("⚠️ Dropbox non connesso");
            return;
        }

        try {
            if (!silent) console.log("🔄 Sync Dropbox...");

            const customers = CustomersModule.getAllCustomers();
            const products = ProductsModule.getAllProducts();
            const orders = OrdersModule.getAllOrders('recent');
            const fidelity = FidelityModule.fidelityCustomers;
            const campaigns = CouponsModule.campaigns;

            // ✅ SALVA CON DELAY per evitare rate limit
            await this.saveDropbox(CONFIG.DROPBOX_PATHS.CUSTOMERS, customers);
            await this.delay(500); // 500ms tra ogni salvataggio

            await this.saveDropbox(CONFIG.DROPBOX_PATHS.PRODUCTS, products);
            await this.delay(500);

            await this.saveDropbox(CONFIG.DROPBOX_PATHS.ORDERS, orders);
            await this.delay(500);

            await this.saveDropbox(CONFIG.DROPBOX_PATHS.FIDELITY, fidelity);
            await this.delay(500);

            await this.saveDropbox(CONFIG.DROPBOX_PATHS.CAMPAIGNS, campaigns);

            if (!silent) {
                console.log("✅ Sync completato");
                localStorage.setItem('lastSync', new Date().toISOString());
            }
        } catch (error) {
            console.error("❌ Errore sync:", error);
        }
    },

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    disconnectDropbox() {
        this.stopAutoSync();
        localStorage.removeItem('dropboxAccessToken');
        localStorage.removeItem('dropboxRefreshToken');
        this.dropboxClient = null;
        this.dropboxAccessToken = null;
        this.dropboxRefreshToken = null;
        Utils.showToast("📦 Dropbox disconnesso", "info");
    },

    // ==========================================
    // SALVATAGGIO DATI
    // ==========================================

    saveLocal(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            console.log(`💾 Salvato in localStorage: ${key}`);
            return true;
        } catch (error) {
            console.error("Errore salvataggio locale:", error);
            Utils.showToast("Errore salvataggio locale", "error");
            return false;
        }
    },

    loadLocal(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (error) {
            console.error("Errore caricamento locale:", error);
            return defaultValue;
        }
    },

    async saveDropbox(key, data) {
        if (!this.dropboxClient) return;

        try {
            const encryptedData = AuthManager.encrypt(data);
            if (!encryptedData) {
                console.error('❌ Errore crittografia');
                return;
            }

            const payload = {
                encrypted: true,
                version: '2.0',
                data: encryptedData
            };

            const content = JSON.stringify(payload);
            const path = key.startsWith('/') ? key : `/${key}.json`; // ← FIX: usa key direttamente se inizia con /

            await this.dropboxClient.filesUpload({
                path: path,
                contents: content,
                mode: 'overwrite',
                autorename: false
            });

            console.log(`📦 Salvato criptato su Dropbox: ${key}`);
        } catch (error) {
            console.error("Errore salvataggio Dropbox:", error);

            if (error.status === 401 && this.dropboxRefreshToken) {
                const newToken = await this.refreshAccessToken();
                if (newToken) {
                    return await this.saveDropbox(key, data);
                }
            }
        }
    },

    async loadDropbox(key) {
        if (!this.dropboxClient) return null;

        try {
            const path = key.startsWith('/') ? key : `/${key}.json`; // ← FIX
            const response = await this.dropboxClient.filesDownload({ path });


            const reader = new FileReader();
            return new Promise((resolve, reject) => {
                reader.onload = () => {
                    try {
                        const parsedData = JSON.parse(reader.result);

                        if (parsedData.encrypted) {
                            const decrypted = AuthManager.decrypt(parsedData.data);
                            if (!decrypted) {
                                console.error('❌ Errore decrittazione');
                                reject(new Error('Decryption failed'));
                                return;
                            }
                            console.log(`📦 Caricato e decriptato: ${key}`);
                            resolve(decrypted);
                        } else {
                            resolve(parsedData);
                        }
                    } catch (e) {
                        reject(e);
                    }
                };
                reader.onerror = reject;
                reader.readAsText(response.result.fileBlob);
            });
        } catch (error) {
            if (error.status === 409) {
                console.log(`📦 File ${key} non esiste ancora`);
                return null;
            }

            if (error.status === 401 && this.dropboxRefreshToken) {
                const newToken = await this.refreshAccessToken();
                if (newToken) {
                    return await this.loadDropbox(key);
                }
            }

            return null;
        }
    },

    // ==========================================
    // FUNZIONI COMODE
    // ==========================================

    async saveOrders(orders) {
        this.saveLocal(CONFIG.STORAGE_KEYS.ORDERS, orders);
        await this.saveDropbox(CONFIG.DROPBOX_PATHS.ORDERS, orders);
    },

    async loadOrders() {
        const cloudData = await this.loadDropbox(CONFIG.DROPBOX_PATHS.ORDERS);
        if (cloudData) return cloudData;
        return this.loadLocal(CONFIG.STORAGE_KEYS.ORDERS, []);
    },

    async saveCustomers(customers) {
        this.saveLocal(CONFIG.STORAGE_KEYS.CUSTOMERS, customers);
        await this.saveDropbox(CONFIG.DROPBOX_PATHS.CUSTOMERS, customers);
    },

    async loadCustomers() {
        const cloudData = await this.loadDropbox(CONFIG.DROPBOX_PATHS.CUSTOMERS);
        if (cloudData) return cloudData;
        return this.loadLocal(CONFIG.STORAGE_KEYS.CUSTOMERS, []);
    },

    async saveProducts(products) {
        this.saveLocal(CONFIG.STORAGE_KEYS.PRODUCTS, products);
        await this.saveDropbox(CONFIG.DROPBOX_PATHS.PRODUCTS, products);
    },

    async loadProducts() {
        const cloudData = await this.loadDropbox(CONFIG.DROPBOX_PATHS.PRODUCTS);
        if (cloudData) return cloudData;
        return this.loadLocal(CONFIG.STORAGE_KEYS.PRODUCTS, []);
    },

    async saveFidelity(fidelityData) {
        this.saveLocal(CONFIG.STORAGE_KEYS.FIDELITY, fidelityData);
        await this.saveDropbox(CONFIG.DROPBOX_PATHS.FIDELITY, fidelityData);
    },

    async loadFidelity() {
        const cloudData = await this.loadDropbox(CONFIG.DROPBOX_PATHS.FIDELITY);
        if (cloudData) return cloudData;
        return this.loadLocal(CONFIG.STORAGE_KEYS.FIDELITY, []);
    },

    async saveCampaigns(campaigns) {
        this.saveLocal(CONFIG.STORAGE_KEYS.CAMPAIGNS, campaigns);
        await this.saveDropbox(CONFIG.DROPBOX_PATHS.CAMPAIGNS, campaigns);
    },

    async loadCampaigns() {
        const cloudData = await this.loadDropbox(CONFIG.DROPBOX_PATHS.CAMPAIGNS);
        if (cloudData) return cloudData;
        return this.loadLocal(CONFIG.STORAGE_KEYS.CAMPAIGNS, []);
    }
};

window.Storage = Storage;
console.log("✅ Storage caricato");