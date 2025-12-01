// ============================================
// 💾 GESTIONE STORAGE (localStorage + Dropbox)
// ============================================

const Storage = {
    
    // Riferimento al client Dropbox (verrà inizializzato dopo)
    dropboxClient: null,
    isDropboxConnected: false,
    
    // ==========================================
    // INIZIALIZZAZIONE DROPBOX
    // ==========================================
    
    initDropbox() {
        const token = localStorage.getItem(CONFIG.STORAGE_KEYS.DROPBOX_TOKEN);
        
        if (token) {
            this.dropboxClient = new Dropbox.Dropbox({
                clientId: CONFIG.DROPBOX_APP_KEY,
                accessToken: token
            });
            this.isDropboxConnected = true;
            console.log("✅ Dropbox connesso");
            return true;
        }
        
        console.log("⚠️ Dropbox non connesso");
        return false;
    },
    
    // Avvia il processo di autenticazione Dropbox
    async connectDropbox() {
        const dbx = new Dropbox.Dropbox({ clientId: CONFIG.DROPBOX_APP_KEY });
        const authUrl = await dbx.auth.getAuthenticationUrl(CONFIG.getRedirectUri());
        window.location.href = authUrl;
    },
    
    // Gestisce il callback di Dropbox dopo l'autenticazione
    handleDropboxCallback() {
        const params = new URLSearchParams(window.location.hash.substring(1));
        const token = params.get('access_token');
        
        if (token) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.DROPBOX_TOKEN, token);
            this.initDropbox();
            
            // Pulisci l'URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
            Utils.showToast("✅ Dropbox connesso!", "success");
            return true;
        }
        
        return false;
    },
    
    // Disconnetti Dropbox
    disconnectDropbox() {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.DROPBOX_TOKEN);
        this.dropboxClient = null;
        this.isDropboxConnected = false;
        Utils.showToast("Dropbox disconnesso", "info");
    },
    
    // ==========================================
    // SALVATAGGIO DATI
    // ==========================================
    
    // Salva dati in localStorage
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
    
    // Carica dati da localStorage
    loadLocal(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (error) {
            console.error("Errore caricamento locale:", error);
            return defaultValue;
        }
    },
    
    // Salva su Dropbox
    async saveDropbox(path, data) {
        if (!this.isDropboxConnected) {
            console.log("⚠️ Dropbox non connesso, salvo solo localmente");
            return false;
        }
        
        try {
            await this.dropboxClient.filesUpload({
                path: path,
                contents: JSON.stringify(data, null, 2),
                mode: 'overwrite',
                autorename: false
            });
            
            console.log(`☁️ Salvato su Dropbox: ${path}`);
            return true;
        } catch (error) {
            console.error("Errore salvataggio Dropbox:", error);
            Utils.showToast("Errore sincronizzazione Dropbox", "warning");
            return false;
        }
    },
    
    // Carica da Dropbox
    async loadDropbox(path, defaultValue = null) {
        if (!this.isDropboxConnected) {
            return null;
        }
        
        try {
            const response = await this.dropboxClient.filesDownload({ path: path });
            const text = await response.result.fileBlob.text();
            const data = JSON.parse(text);
            console.log(`☁️ Caricato da Dropbox: ${path}`);
            return data;
        } catch (error) {
            if (error.status === 409) {
                console.log(`📁 File non trovato su Dropbox: ${path}`);
            } else {
                console.error("Errore caricamento Dropbox:", error);
            }
            return defaultValue;
        }
    },
    
    // ==========================================
    // FUNZIONI COMODE (salvano sia locale che cloud)
    // ==========================================
    
    // Salva ordini
    async saveOrders(orders) {
        this.saveLocal(CONFIG.STORAGE_KEYS.ORDERS, orders);
        await this.saveDropbox(CONFIG.DROPBOX_PATHS.ORDERS, orders);
    },
    
    // Carica ordini
    async loadOrders() {
        // Prova prima da Dropbox, poi da localStorage
        const cloudData = await this.loadDropbox(CONFIG.DROPBOX_PATHS.ORDERS);
        if (cloudData) return cloudData;
        
        return this.loadLocal(CONFIG.STORAGE_KEYS.ORDERS, []);
    },
    
    // Salva clienti
    async saveCustomers(customers) {
        this.saveLocal(CONFIG.STORAGE_KEYS.CUSTOMERS, customers);
        await this.saveDropbox(CONFIG.DROPBOX_PATHS.CUSTOMERS, customers);
    },
    
    // Carica clienti
    async loadCustomers() {
        const cloudData = await this.loadDropbox(CONFIG.DROPBOX_PATHS.CUSTOMERS);
        if (cloudData) return cloudData;
        
        return this.loadLocal(CONFIG.STORAGE_KEYS.CUSTOMERS, []);
    },
    
    // Salva prodotti
    async saveProducts(products) {
        this.saveLocal(CONFIG.STORAGE_KEYS.PRODUCTS, products);
        await this.saveDropbox(CONFIG.DROPBOX_PATHS.PRODUCTS, products);
    },
    
    // Carica prodotti
    async loadProducts() {
        const cloudData = await this.loadDropbox(CONFIG.DROPBOX_PATHS.PRODUCTS);
        if (cloudData) return cloudData;
        
        return this.loadLocal(CONFIG.STORAGE_KEYS.PRODUCTS, []);
    },
    
    // Salva fidelity
    async saveFidelity(fidelityData) {
        this.saveLocal(CONFIG.STORAGE_KEYS.FIDELITY, fidelityData);
        await this.saveDropbox(CONFIG.DROPBOX_PATHS.FIDELITY, fidelityData);
    },
    
    // Carica fidelity
    async loadFidelity() {
        const cloudData = await this.loadDropbox(CONFIG.DROPBOX_PATHS.FIDELITY);
        if (cloudData) return cloudData;
        
        return this.loadLocal(CONFIG.STORAGE_KEYS.FIDELITY, []);
    },
    
    // Salva campagne
    async saveCampaigns(campaigns) {
        this.saveLocal(CONFIG.STORAGE_KEYS.CAMPAIGNS, campaigns);
        await this.saveDropbox(CONFIG.DROPBOX_PATHS.CAMPAIGNS, campaigns);
    },
    
    // Carica campagne
    async loadCampaigns() {
        const cloudData = await this.loadDropbox(CONFIG.DROPBOX_PATHS.CAMPAIGNS);
        if (cloudData) return cloudData;
        
        return this.loadLocal(CONFIG.STORAGE_KEYS.CAMPAIGNS, []);
    }
};

// Rendi Storage disponibile globalmente
window.Storage = Storage;

console.log("✅ Storage caricato");