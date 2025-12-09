// ============================================
// 👥 GESTIONE CLIENTI
// ============================================

const CustomersModule = {

    customers: [],

    // ==========================================
    // INIZIALIZZAZIONE
    // ==========================================

    async init() {
        await this.loadCustomers();
        console.log("✅ Modulo Clienti inizializzato");
    },

    // ==========================================
    // CARICAMENTO DATI
    // ==========================================

    async loadCustomers() {
        this.customers = await Storage.loadCustomers();
        console.log(`📋 Caricati ${this.customers.length} clienti`);
    },

    async saveCustomers() {
        await Storage.saveCustomers(this.customers);
        console.log("💾 Clienti salvati");
    },

    // ==========================================
    // OPERAZIONI CRUD
    // ==========================================

    // Aggiungi nuovo cliente
    addCustomer(customerData) {
        // ✅ CONTROLLO DUPLICATI RAFFORZATO

        // 1. Controlla telefono
        if (customerData.phone && customerData.phone.trim()) {
            const phoneClean = customerData.phone.replace(/\s+/g, ''); // Rimuovi spazi
            const existing = this.customers.find(c => {
                const existingPhone = (c.phone || '').replace(/\s+/g, '');
                return existingPhone === phoneClean;
            });

            if (existing) {
                Utils.showToast(`❌ Cliente già esistente: ${existing.firstName} ${existing.lastName}`, "error");
                return null;
            }
        }

        // 2. Controlla nome+cognome (se telefono vuoto)
        if (!customerData.phone || !customerData.phone.trim()) {
            const nameMatch = this.customers.find(c =>
                c.firstName.toLowerCase() === customerData.firstName.toLowerCase() &&
                c.lastName.toLowerCase() === customerData.lastName.toLowerCase()
            );

            if (nameMatch) {
                const confirm = window.confirm(
                    `⚠️ Esiste già "${nameMatch.firstName} ${nameMatch.lastName}".\n\n` +
                    `Vuoi creare un duplicato comunque?`
                );
                if (!confirm) return null;
            }
        }

        const customer = {
            id: Utils.generateId(),
            firstName: customerData.firstName,
            lastName: customerData.lastName,
            phone: customerData.phone || '',
            email: customerData.email || '',
            address: customerData.address || '',
            notes: customerData.notes || '',
            inWhatsAppGroup: customerData.inWhatsAppGroup || false,
            createdAt: new Date().toISOString(),
            totalOrders: 0,
            totalSpent: 0
        };

        this.customers.push(customer);
        this.saveCustomers();

        // ✅ AUTO-CREA FIDELITY CARD
        FidelityModule.addCustomerToFidelity(customer.id);

        Utils.showToast(`✅ Cliente "${customer.firstName} ${customer.lastName}" aggiunto!`, "success");

        return customer;
    },

    // Aggiorna cliente esistente
    updateCustomer(customerId, updates) {
        const index = this.customers.findIndex(c => c.id === customerId);

        if (index === -1) {
            Utils.showToast("Cliente non trovato", "error");
            return null;
        }

        this.customers[index] = {
            ...this.customers[index],
            ...updates,
            id: customerId // Non permettere cambio ID
        };

        this.saveCustomers();
        Utils.showToast("✅ Cliente aggiornato!", "success");
        return this.customers[index];
    },

    // Elimina cliente
    deleteCustomer(customerId) {
        const index = this.customers.findIndex(c => c.id === customerId);

        if (index === -1) {
            Utils.showToast("Cliente non trovato", "error");
            return false;
        }

        const customer = this.customers[index];

        if (confirm(`Eliminare il cliente "${customer.firstName} ${customer.lastName}"?`)) {
            this.customers.splice(index, 1);
            this.saveCustomers();
            Utils.showToast("✅ Cliente eliminato", "success");
            return true;
        }

        return false;
    },

    // ==========================================
    // RICERCA E FILTRI
    // ==========================================

    // Trova cliente per ID
    getCustomerById(customerId) {
        return this.customers.find(c => c.id === customerId);
    },

    // Cerca clienti per nome/telefono
    searchCustomers(query) {
        if (!query) return this.customers;

        const lowerQuery = query.toLowerCase();

        return this.customers.filter(c =>
            c.firstName.toLowerCase().includes(lowerQuery) ||
            c.lastName.toLowerCase().includes(lowerQuery) ||
            c.phone.includes(query) ||
            c.email.toLowerCase().includes(lowerQuery)
        );
    },

    // Ottieni tutti i clienti ordinati
    getAllCustomers(sortBy = 'name') {
        const sorted = [...this.customers];

        switch (sortBy) {
            case 'name':
                sorted.sort((a, b) =>
                    a.firstName.localeCompare(b.firstName)
                );
                break;
            case 'orders':
                sorted.sort((a, b) => b.totalOrders - a.totalOrders);
                break;
            case 'spent':
                sorted.sort((a, b) => b.totalSpent - a.totalSpent);
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
    // STATISTICHE CLIENTE
    // ==========================================

    // Aggiorna statistiche dopo un ordine
    updateCustomerStats(customerId, orderAmount) {
        const customer = this.getCustomerById(customerId);

        if (customer) {
            customer.totalOrders = (customer.totalOrders || 0) + 1;
            customer.totalSpent = (customer.totalSpent || 0) + orderAmount;
            customer.lastOrderDate = new Date().toISOString();
            this.saveCustomers();
        }
    },

    // Ottieni top clienti per spesa
    getTopCustomers(limit = 10) {
        return this.getAllCustomers('spent').slice(0, limit);
    },

    // ==========================================
    // VALIDAZIONE
    // ==========================================

    validateCustomer(customerData) {
        const errors = [];

        if (!customerData.firstName || customerData.firstName.trim() === '') {
            errors.push("Nome obbligatorio");
        }

        if (!customerData.lastName || customerData.lastName.trim() === '') {
            errors.push("Cognome obbligatorio");
        }

        if (customerData.email && !Utils.isValidEmail(customerData.email)) {
            errors.push("Email non valida");
        }

        if (customerData.phone && !Utils.isValidPhone(customerData.phone)) {
            errors.push("Telefono non valido");
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    },

    // ==========================================
    // UTILITY
    // ==========================================

    // Conta clienti totali
    getCustomersCount() {
        return this.customers.length;
    },

    // Formatta nome completo
    getFullName(customerId) {
        const customer = this.getCustomerById(customerId);
        return customer ? `${customer.firstName} ${customer.lastName}` : 'Cliente sconosciuto';
    }
};

// Rendi il modulo disponibile globalmente
window.CustomersModule = CustomersModule;

console.log("✅ Modulo Clienti caricato");