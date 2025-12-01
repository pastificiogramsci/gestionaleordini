// ============================================
// 🔧 CONFIGURAZIONI GLOBALI
// ============================================
// Questo file contiene tutte le impostazioni dell'applicazione

const CONFIG = {
    // Dropbox
    DROPBOX_APP_KEY: "jxj7rn2nzrs3y0p",
    
    // Rileva automaticamente l'ambiente (locale o online)
    getRedirectUri() {
        const hostname = window.location.hostname;
        if (hostname === "127.0.0.1" || hostname === "localhost") {
            return "http://127.0.0.1:5500/";
        } else {
            return `${window.location.origin}${window.location.pathname}`;
        }
    },
    
    // File su Dropbox
    DROPBOX_PATHS: {
        ORDERS: "/ordini.json",
        CUSTOMERS: "/clienti.json",
        PRODUCTS: "/prodotti.json",
        FIDELITY: "/fidelity.json",
        CAMPAIGNS: "/campagne.json"
    },
    
    // LocalStorage Keys
    STORAGE_KEYS: {
        ORDERS: "orders",
        CUSTOMERS: "customers",
        PRODUCTS: "products",
        FIDELITY: "fidelityCustomers",
        CAMPAIGNS: "campaigns",
        DROPBOX_TOKEN: "dropboxAccessToken"
    },
    
    // Impostazioni Fidelity
    FIDELITY: {
        STAMPS_FOR_REWARD: 10,
        DEFAULT_REWARD: "Una pasta fresca omaggio"
    }
};

// Rendi CONFIG disponibile globalmente
window.CONFIG = CONFIG;

console.log("✅ Config caricato:", CONFIG);