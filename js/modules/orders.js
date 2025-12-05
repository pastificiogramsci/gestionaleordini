// ============================================
// 📦 GESTIONE ORDINI
// ============================================

const OrdersModule = {

    orders: [],

    // Stati possibili degli ordini
    ORDER_STATUS: {
        PENDING: 'pending',
        CONFIRMED: 'confirmed',
        IN_PREPARATION: 'in_preparation',  // ← NUOVO
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
    // UTILITY
    // ==========================================

    generateOrderNumber() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        return `ORD-${year}${month}${day}-${hours}${minutes}${seconds}`;
    },

    // ==========================================
    // OPERAZIONI CRUD
    // ==========================================

    // Crea nuovo ordine
    createOrder(orderData) {
        const order = {
            id: Utils.generateId(),
            orderNumber: this.generateOrderNumber(),
            customerId: orderData.customerId,
            items: orderData.items,
            totalAmount: this.calculateTotal(orderData.items),
            deposit: parseFloat(orderData.deposit) || 0, // ← AGGIUNGI
            depositPaid: orderData.depositPaid || false, // ← AGGIUNGI
            status: this.ORDER_STATUS.PENDING,
            deliveryDate: orderData.deliveryDate,
            deliveryTime: orderData.deliveryTime || '',
            notes: orderData.notes || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.orders.push(order);
        this.saveOrders();

        Utils.showToast("✅ Ordine creato!", "success");
        return order;
    },

    // Aggiorna ordine esistente
    updateOrder(orderId, updates) {
        const order = this.getOrderById(orderId);
        if (!order) return null;

        // Preserva flag prepared degli item esistenti
        if (updates.items) {
            updates.items = updates.items.map(newItem => {
                const oldItem = order.items.find(i => i.productId === newItem.productId);
                return {
                    ...newItem,
                    prepared: oldItem ? oldItem.prepared : false
                };
            });
        }

        Object.assign(order, updates);
        order.updatedAt = new Date().toISOString();

        this.saveOrders();
        return order;
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

        if (newStatus === this.ORDER_STATUS.DELIVERED) {
            order.deliveredAt = new Date().toISOString();
        }

        // Se passa a in_preparation e tutto è già preparato → vai direttamente a ready
        if (newStatus === this.ORDER_STATUS.IN_PREPARATION) {
            const allPrepared = order.items.every(item => item.prepared);
            if (allPrepared) {
                order.status = this.ORDER_STATUS.READY;
                newStatus = this.ORDER_STATUS.READY;
            }
        }

        this.saveOrders();

        // Fidelity - SOLO se NON c'è campagna coupon attiva
        if (newStatus === this.ORDER_STATUS.DELIVERED && FidelityModule) {
            const hasCouponCampaign = CouponsModule.campaigns.some(c =>
                c.active &&
                this.isDateInCampaign(order.deliveryDate, c)
            );

            if (!hasCouponCampaign) {
                const stampsToAdd = Math.floor(order.totalAmount / 10);
                if (stampsToAdd > 0) {
                    FidelityModule.addStamps(order.customerId, stampsToAdd, order.id);
                }
            } else {
                console.log('🎫 Coupon attivo - bollini non assegnati');
            }
        }

        // Assegna coupon automaticamente se consegna rientra in campagna attiva
        if (newStatus === this.ORDER_STATUS.DELIVERED && CouponsModule) {
            const activeCampaign = CouponsModule.campaigns.find(c =>
                c.active && this.isDateInCampaign(order.deliveryDate, c)
            );

            if (activeCampaign) {
                const customer = CustomersModule.getCustomerById(order.customerId);
                let couponAssigned = false;

                if (!customer?.coupons?.some(cp => cp.campaignId === activeCampaign.id)) {
                    CouponsModule.assignCoupon(order.customerId, activeCampaign.id);
                    couponAssigned = true;
                    console.log('🎫 Coupon assegnato automaticamente');
                }

                // Manda messaggio WhatsApp con coupon
                if (WhatsAppModule && couponAssigned) {
                    setTimeout(() => {
                        if (confirm("Mandare notifica consegna + coupon su WhatsApp?")) {
                            WhatsAppModule.sendDeliveryNotification(order, true);
                        }
                    }, 500);
                }
            } else if (WhatsAppModule) {

                // Solo notifica consegna senza coupon
                setTimeout(() => {
                    if (confirm("Mandare notifica consegna su WhatsApp?")) {
                        WhatsAppModule.sendDeliveryNotification(order, false);
                    }
                }, 500);
            }
        }

        const statusNames = {
            pending: "In attesa",
            confirmed: "Confermato",
            in_preparation: "In preparazione",
            ready: "Pronto",
            delivered: "Consegnato",
            cancelled: "Annullato"
        };

        Utils.showToast(`✅ Ordine → ${statusNames[newStatus]}`, "success");
        return order;
    },

    isDateInCampaign(deliveryDate, campaign) {
        if (!deliveryDate) return false;

        if (campaign.dateType === 'single' || campaign.dateType === 'multiple') {
            return campaign.dates.includes(deliveryDate);
        } else if (campaign.dateType === 'range') {
            return deliveryDate >= campaign.dateFrom && deliveryDate <= campaign.dateTo;
        }

        return false;
    },

    addModification(orderId, modifications) {
        const order = this.getOrderById(orderId);
        if (!order) return null;

        if (!order.modifications) {
            order.modifications = {
                toAdd: [],
                toRemove: [],
                createdAt: new Date().toISOString()
            };
        }

        if (modifications.toAdd) {
            modifications.toAdd.forEach(item => {
                order.modifications.toAdd.push({
                    ...item,
                    completed: false
                });
            });
        }

        if (modifications.toRemove) {
            modifications.toRemove.forEach(item => {
                order.modifications.toRemove.push({
                    ...item,
                    completed: false
                });
            });
        }

        this.saveOrders();
        Utils.showToast("✅ Modifiche registrate", "success");
        return order;
    },

    markModificationComplete(orderId, type, index) {
        const order = this.getOrderById(orderId);
        if (!order || !order.modifications) return;

        if (type === 'add') {
            order.modifications.toAdd[index].completed = true;
        } else {
            order.modifications.toRemove[index].completed = true;
        }

        // Controlla se tutte completate
        const allDone =
            order.modifications.toAdd.every(m => m.completed) &&
            order.modifications.toRemove.every(m => m.completed);

        if (allDone) {
            delete order.modifications;

            // Se ordine era in_preparation e tutti item preparati, torna ready
            if (order.status === this.ORDER_STATUS.IN_PREPARATION) {
                const allPrepared = order.items.every(item => item.prepared);
                if (allPrepared) {
                    this.changeOrderStatus(orderId, this.ORDER_STATUS.READY);
                }
            }
        }

        this.saveOrders();
        return order;
    },

    getOrdersWithModifications(date = null) {
        return this.orders.filter(o => {
            if (!o.modifications) return false;
            if (date && o.deliveryDate !== date) return false;

            const hasPending =
                o.modifications.toAdd.some(m => !m.completed) ||
                o.modifications.toRemove.some(m => !m.completed);

            return hasPending;
        });
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

    markItemPrepared(orderId, itemIndex) {
        const order = this.getOrderById(orderId);
        if (!order) return;

        order.items[itemIndex].prepared = true;

        // Controlla se tutti preparati
        const allPrepared = order.items.every(item => item.prepared);
        if (allPrepared && order.status === this.ORDER_STATUS.IN_PREPARATION) {
            this.changeOrderStatus(orderId, this.ORDER_STATUS.READY);
        }

        this.saveOrders();
        return order;
    },

    markAllItemsOfProductPrepared(productId, date) {
        const orders = this.getOrdersByDeliveryDate(date).filter(o =>
            o.status === 'pending' || o.status === 'in_preparation' || o.status === 'confirmed'
        );

        let marked = 0;
        orders.forEach(order => {
            order.items.forEach(item => {
                if (item.productId === productId) {
                    item.prepared = true;
                    marked++;
                }
            });

            // Se tutto preparato E ordine confermato/in_preparation, vai a ready
            if (order.items.every(i => i.prepared)) {
                if (order.status === this.ORDER_STATUS.IN_PREPARATION) {
                    this.changeOrderStatus(order.id, this.ORDER_STATUS.READY);
                }
                // Se pending, non fare nulla - passerà automaticamente a ready quando confermi
            }
        });

        this.saveOrders();
        return marked;
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