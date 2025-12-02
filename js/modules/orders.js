// ============================================
// 📦 GESTIONE ORDINI
// ============================================

const OrdersModule = {

    orders: [],

    // Stati possibili degli ordini
    ORDER_STATUS: {
        PENDING: 'pending',
        CONFIRMED: 'confirmed',
        READY: 'ready',
        DELIVERED: 'delivered',
        CANCELLED: 'cancelled'
    },

    // ==========================================
    // INIZIALIZZAZIONE
    // ==========================================

    async init() {
        await this.loadOrders();
        console.log("✅ Modulo Ordini inizializzato");
    },

    // ==========================================
    // CARICAMENTO DATI
    // ==========================================

    async loadOrders() {
        this.orders = await Storage.loadOrders();
        console.log(`📋 Caricati ${this.orders.length} ordini`);
    },

    async saveOrders() {
        await Storage.saveOrders(this.orders);
        console.log("💾 Ordini salvati");
    },

    // ==========================================
    // OPERAZIONI CRUD
    // ==========================================

    // Crea nuovo ordine
    createOrder(orderData) {
        // Genera numero ordine progressivo per data
        const sameDate = this.orders.filter(o => o.deliveryDate === orderData.deliveryDate);
        const dateStr = orderData.deliveryDate ? new Date(orderData.deliveryDate).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : '';
        const orderNumber = `${sameDate.length + 1}-${dateStr}`;
        const order = {
            id: Utils.generateId(),
            orderNumber: orderNumber,
            customerId: orderData.customerId,
            items: orderData.items || [], // Array di { productId, quantity, price }
            totalAmount: this.calculateOrderTotal(orderData.items),
            status: this.ORDER_STATUS.PENDING,
            deliveryDate: orderData.deliveryDate || null,
            deliveryTime: orderData.deliveryTime || null,
            notes: orderData.notes || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.orders.push(order);
        this.saveOrders();

        // Aggiorna statistiche cliente
        if (CustomersModule) {
            CustomersModule.updateCustomerStats(order.customerId, order.totalAmount);
        }

        Utils.showToast("✅ Ordine creato!", "success");
        return order;
    },

    // Aggiorna ordine esistente
    updateOrder(orderId, updates) {
        const index = this.orders.findIndex(o => o.id === orderId);

        if (index === -1) {
            Utils.showToast("Ordine non trovato", "error");
            return null;
        }

        // Se gli items cambiano, ricalcola il totale
        if (updates.items) {
            updates.totalAmount = this.calculateOrderTotal(updates.items);
        }

        this.orders[index] = {
            ...this.orders[index],
            ...updates,
            id: orderId,
            updatedAt: new Date().toISOString()
        };

        this.saveOrders();
        Utils.showToast("✅ Ordine aggiornato!", "success");
        return this.orders[index];
    },

    // Elimina ordine
    deleteOrder(orderId) {
        const index = this.orders.findIndex(o => o.id === orderId);

        if (index === -1) {
            Utils.showToast("Ordine non trovato", "error");
            return false;
        }

        if (confirm("Eliminare questo ordine?")) {
            this.orders.splice(index, 1);
            this.saveOrders();
            Utils.showToast("✅ Ordine eliminato", "success");
            return true;
        }

        return false;
    },

    // ==========================================
    // GESTIONE STATO ORDINE
    // ==========================================

    // Cambia stato ordine
    changeOrderStatus(orderId, newStatus) {
        const order = this.getOrderById(orderId);

        if (!order) {
            Utils.showToast("Ordine non trovato", "error");
            return null;
        }

        order.status = newStatus;
        order.updatedAt = new Date().toISOString();

        // Traccia quando è stato consegnato
        if (newStatus === this.ORDER_STATUS.DELIVERED) {
            order.deliveredAt = new Date().toISOString();
        }

        this.saveOrders();

        // Se consegnato, aggiungi bollini fidelity
        if (newStatus === this.ORDER_STATUS.DELIVERED && FidelityModule) {
            const stampsToAdd = Math.floor(order.totalAmount / 10);
            if (stampsToAdd > 0) {
                FidelityModule.addStamps(order.customerId, stampsToAdd, order.id);
            }
        }

        const statusNames = {
            pending: "In attesa",
            confirmed: "Confermato",
            ready: "Pronto",
            delivered: "Consegnato",
            cancelled: "Annullato"
        };

        Utils.showToast(`✅ Ordine → ${statusNames[newStatus]}`, "success");
        return order;
    },

    // ==========================================
    // RICERCA E FILTRI
    // ==========================================

    // Trova ordine per ID
    getOrderById(orderId) {
        return this.orders.find(o => o.id === orderId);
    },

    // Ottieni ordini di un cliente
    getOrdersByCustomer(customerId) {
        return this.orders.filter(o => o.customerId === customerId);
    },

    // Ottieni ordini per stato
    getOrdersByStatus(status) {
        return this.orders.filter(o => o.status === status);
    },

    // Ottieni ordini per data di consegna
    getOrdersByDeliveryDate(date) {
        const dateStr = new Date(date).toISOString().split('T')[0];
        return this.orders.filter(o => {
            if (!o.deliveryDate) return false;
            return o.deliveryDate.startsWith(dateStr);
        });
    },

    // Ottieni ordini di oggi
    getTodayOrders() {
        const today = new Date().toISOString().split('T')[0];
        return this.getOrdersByDeliveryDate(today);
    },

    // Ottieni ordini attivi (non consegnati/annullati)
    getActiveOrders() {
        return this.orders.filter(o =>
            o.status !== this.ORDER_STATUS.DELIVERED &&
            o.status !== this.ORDER_STATUS.CANCELLED
        );
    },

    // Ottieni tutti gli ordini ordinati
    getAllOrders(sortBy = 'recent') {
        const sorted = [...this.orders];

        switch (sortBy) {
            case 'recent':
                sorted.sort((a, b) =>
                    new Date(b.createdAt) - new Date(a.createdAt)
                );
                break;
            case 'delivery':
                sorted.sort((a, b) => {
                    if (!a.deliveryDate) return 1;
                    if (!b.deliveryDate) return -1;
                    return new Date(a.deliveryDate) - new Date(b.deliveryDate);
                });
                break;
            case 'amount':
                sorted.sort((a, b) => b.totalAmount - a.totalAmount);
                break;
        }

        return sorted;
    },

    // ==========================================
    // CALCOLI E STATISTICHE
    // ==========================================

    // Calcola totale ordine
    calculateOrderTotal(items) {
        if (!items || items.length === 0) return 0;

        return items.reduce((total, item) => {
            return total + (item.price * item.quantity);
        }, 0);
    },

    // Ottieni fatturato totale
    getTotalRevenue(status = null) {
        let ordersToCount = this.orders;

        if (status) {
            ordersToCount = this.getOrdersByStatus(status);
        }

        return ordersToCount.reduce((total, order) => {
            return total + order.totalAmount;
        }, 0);
    },

    // Ottieni fatturato per periodo
    getRevenueByPeriod(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        return this.orders
            .filter(o => {
                const orderDate = new Date(o.createdAt);
                return orderDate >= start && orderDate <= end;
            })
            .reduce((total, order) => total + order.totalAmount, 0);
    },

    // Ottieni statistiche ordini
    getOrdersStats() {
        return {
            total: this.orders.length,
            pending: this.getOrdersByStatus(this.ORDER_STATUS.PENDING).length,
            confirmed: this.getOrdersByStatus(this.ORDER_STATUS.CONFIRMED).length,
            ready: this.getOrdersByStatus(this.ORDER_STATUS.READY).length,
            delivered: this.getOrdersByStatus(this.ORDER_STATUS.DELIVERED).length,
            cancelled: this.getOrdersByStatus(this.ORDER_STATUS.CANCELLED).length,
            active: this.getActiveOrders().length,
            todayOrders: this.getTodayOrders().length,
            totalRevenue: this.getTotalRevenue(),
            deliveredRevenue: this.getTotalRevenue(this.ORDER_STATUS.DELIVERED)
        };
    },

    // ==========================================
    // VALIDAZIONE
    // ==========================================

    validateOrder(orderData) {
        const errors = [];

        if (!orderData.customerId) {
            errors.push("Cliente obbligatorio");
        }

        if (!orderData.items || orderData.items.length === 0) {
            errors.push("Aggiungi almeno un prodotto");
        }

        if (orderData.items) {
            orderData.items.forEach((item, index) => {
                if (!item.productId) {
                    errors.push(`Prodotto ${index + 1}: ID mancante`);
                }
                if (!item.quantity || item.quantity <= 0) {
                    errors.push(`Prodotto ${index + 1}: Quantità non valida`);
                }
            });
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    },

    // ==========================================
    // UTILITY
    // ==========================================

    // Conta ordini totali
    getOrdersCount() {
        return this.orders.length;
    },

    // Ottieni valore medio ordine
    getAverageOrderValue() {
        if (this.orders.length === 0) return 0;
        return this.getTotalRevenue() / this.orders.length;
    },

    // Formatta dettagli ordine per visualizzazione
    formatOrderDetails(orderId) {
        const order = this.getOrderById(orderId);
        if (!order) return null;

        const customer = CustomersModule ?
            CustomersModule.getCustomerById(order.customerId) : null;

        const items = order.items.map(item => {
            const product = ProductsModule ?
                ProductsModule.getProductById(item.productId) : null;

            return {
                ...item,
                productName: product ? product.name : 'Prodotto sconosciuto'
            };
        });

        return {
            ...order,
            customerName: customer ?
                `${customer.firstName} ${customer.lastName}` :
                'Cliente sconosciuto',
            items: items
        };
    }
};

// Rendi il modulo disponibile globalmente
window.OrdersModule = OrdersModule;

console.log("✅ Modulo Ordini caricato");