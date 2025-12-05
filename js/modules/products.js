// ============================================
// 🍝 GESTIONE PRODOTTI
// ============================================

const ProductsModule = {

    products: [],

    // ==========================================
    // INIZIALIZZAZIONE
    // ==========================================

    async init() {
        await this.loadProducts();
        console.log("✅ Modulo Prodotti inizializzato");
    },

    // ==========================================
    // CARICAMENTO DATI
    // ==========================================

    async loadProducts() {
        this.products = await Storage.loadProducts();
        console.log(`📋 Caricati ${this.products.length} prodotti`);
    },

    async saveProducts() {
        await Storage.saveProducts(this.products);
        console.log("💾 Prodotti salvati");
    },

    // ==========================================
    // OPERAZIONI CRUD
    // ==========================================

    // Aggiungi nuovo prodotto
    addProduct(productData) {
        const product = {
            id: Utils.generateId(),
            name: productData.name,
            price: parseFloat(productData.price) || 0,
            category: productData.category || 'Altro',
            description: productData.description || '',
            unit: productData.unit || 'kg',
            averageWeight: productData.averageWeight || null,
            mode: productData.mode || 'pieces', // ← AGGIUNGI
            ingredients: productData.ingredients || '',
            allergens: productData.allergens || [],
            active: true,
            createdAt: new Date().toISOString()
        };

        this.products.push(product);
        this.saveProducts();

        Utils.showToast(`✅ Prodotto "${product.name}" aggiunto!`, "success");
        return product;
    },

    // Aggiorna prodotto esistente
    updateProduct(productId, updates) {
        const product = this.getProductById(productId);
        if (!product) return null;

        product.name = updates.name || product.name;
        product.price = parseFloat(updates.price) || product.price;
        product.category = updates.category || product.category;
        product.description = updates.description !== undefined ? updates.description : product.description;
        product.unit = updates.unit || product.unit;
        product.averageWeight = updates.averageWeight !== undefined ? updates.averageWeight : product.averageWeight;
        product.mode = updates.mode || product.mode; // ← AGGIUNGI
        product.ingredients = updates.ingredients !== undefined ? updates.ingredients : product.ingredients;
        product.allergens = updates.allergens !== undefined ? updates.allergens : product.allergens;

        this.saveProducts();
        Utils.showToast("✅ Prodotto aggiornato!", "success");
        return product;
    },

    // Elimina prodotto
    deleteProduct(productId) {
        const index = this.products.findIndex(p => p.id === productId);

        if (index === -1) {
            Utils.showToast("Prodotto non trovato", "error");
            return false;
        }

        const product = this.products[index];

        if (confirm(`Eliminare il prodotto "${product.name}"?`)) {
            this.products.splice(index, 1);
            this.saveProducts();
            Utils.showToast("✅ Prodotto eliminato", "success");
            return true;
        }

        return false;
    },

    // Attiva/Disattiva prodotto
    toggleProductActive(productId) {
        const product = this.getProductById(productId);

        if (product) {
            product.active = !product.active;
            this.saveProducts();

            const status = product.active ? "attivato" : "disattivato";
            Utils.showToast(`✅ Prodotto ${status}`, "success");
            return product;
        }

        return null;
    },

    // ==========================================
    // RICERCA E FILTRI
    // ==========================================

    // Trova prodotto per ID
    getProductById(productId) {
        return this.products.find(p => p.id === productId);
    },

    // Cerca prodotti per nome
    searchProducts(query) {
        if (!query) return this.getActiveProducts();

        const lowerQuery = query.toLowerCase();

        return this.products.filter(p =>
            p.name.toLowerCase().includes(lowerQuery) ||
            p.category.toLowerCase().includes(lowerQuery)
        );
    },

    // Ottieni solo prodotti attivi
    getActiveProducts() {
        return this.products.filter(p => p.active);
    },

    // Ottieni prodotti per categoria
    getProductsByCategory(category) {
        return this.products.filter(p =>
            p.category === category && p.active
        );
    },

    // Ottieni tutte le categorie
    getCategories() {
        const categories = [...new Set(this.products.map(p => p.category))];
        return categories.sort();
    },

    // Ottieni tutti i prodotti ordinati
    getAllProducts(sortBy = 'name') {
        const sorted = [...this.products];

        switch (sortBy) {
            case 'name':
                sorted.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'price':
                sorted.sort((a, b) => a.price - b.price);
                break;
            case 'category':
                sorted.sort((a, b) => a.category.localeCompare(b.category));
                break;
            case 'recent':
                sorted.sort((a, b) =>
                    new Date(b.createdAt) - new Date(a.createdAt)
                );
                break;
        }

        return sorted;
    },

    // ==========================================
    // VALIDAZIONE
    // ==========================================

    validateProduct(productData) {
        const errors = [];

        if (!productData.name || productData.name.trim() === '') {
            errors.push("Nome prodotto obbligatorio");
        }

        if (productData.price === undefined || productData.price === null) {
            errors.push("Prezzo obbligatorio");
        } else if (parseFloat(productData.price) < 0) {
            errors.push("Prezzo non può essere negativo");
        }

        if (!productData.category || productData.category.trim() === '') {
            errors.push("Categoria obbligatoria");
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    },

    // ==========================================
    // UTILITY
    // ==========================================

    // Conta prodotti totali
    getProductsCount() {
        return this.products.length;
    },

    // Conta prodotti attivi
    getActiveProductsCount() {
        return this.products.filter(p => p.active).length;
    },

    // Calcola prezzo medio
    getAveragePrice() {
        if (this.products.length === 0) return 0;

        const total = this.products.reduce((sum, p) => sum + p.price, 0);
        return total / this.products.length;
    },

    // Formatta prodotto per visualizzazione
    formatProductDisplay(productId) {
        const product = this.getProductById(productId);
        if (!product) return 'Prodotto sconosciuto';

        return `${product.name} - ${Utils.formatPrice(product.price)}`;
    }
};

// Rendi il modulo disponibile globalmente
window.ProductsModule = ProductsModule;

console.log("✅ Modulo Prodotti caricato");