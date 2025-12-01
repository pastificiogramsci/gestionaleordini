// ============================================
// 📊 STATISTICHE E DASHBOARD
// ============================================

const StatsModule = {
    
    // ==========================================
    // STATISTICHE GENERALI
    // ==========================================
    
    // Ottieni tutte le statistiche per la dashboard
    getDashboardStats() {
        const stats = {
            customers: this.getCustomerStats(),
            orders: this.getOrderStats(),
            products: this.getProductStats(),
            fidelity: this.getFidelityStats(),
            coupons: this.getCouponStats(),
            revenue: this.getRevenueStats()
        };
        
        console.log("📊 Statistiche dashboard calcolate", stats);
        return stats;
    },
    
    // ==========================================
    // STATISTICHE CLIENTI
    // ==========================================
    
    getCustomerStats() {
        if (!CustomersModule) return null;
        
        const customers = CustomersModule.getAllCustomers();
        
        return {
            total: customers.length,
            withOrders: customers.filter(c => c.totalOrders > 0).length,
            topSpenders: CustomersModule.getTopCustomers(5)
        };
    },
    
    // ==========================================
    // STATISTICHE ORDINI
    // ==========================================
    
    getOrderStats() {
        if (!OrdersModule) return null;
        
        return OrdersModule.getOrdersStats();
    },
    
    // ==========================================
    // STATISTICHE PRODOTTI
    // ==========================================
    
    getProductStats() {
        if (!ProductsModule) return null;
        
        return {
            total: ProductsModule.getProductsCount(),
            active: ProductsModule.getActiveProductsCount(),
            averagePrice: ProductsModule.getAveragePrice()
        };
    },
    
    // ==========================================
    // STATISTICHE FIDELITY
    // ==========================================
    
    getFidelityStats() {
        if (!FidelityModule) return null;
        
        return FidelityModule.getFidelityStats();
    },
    
    // ==========================================
    // STATISTICHE COUPON
    // ==========================================
    
    getCouponStats() {
        if (!CouponsModule) return null;
        
        return CouponsModule.getCouponStats();
    },
    
    // ==========================================
    // STATISTICHE FATTURATO
    // ==========================================
    
    getRevenueStats() {
        if (!OrdersModule) return null;
        
        const now = new Date();
        
        // Oggi
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);
        
        // Settimana corrente
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        
        // Mese corrente
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        
        // Anno corrente
        const yearStart = new Date(now.getFullYear(), 0, 1);
        
        return {
            total: OrdersModule.getTotalRevenue(),
            delivered: OrdersModule.getTotalRevenue(OrdersModule.ORDER_STATUS.DELIVERED),
            today: OrdersModule.getRevenueByPeriod(todayStart, todayEnd),
            thisWeek: OrdersModule.getRevenueByPeriod(weekStart, now),
            thisMonth: OrdersModule.getRevenueByPeriod(monthStart, now),
            thisYear: OrdersModule.getRevenueByPeriod(yearStart, now),
            averageOrderValue: OrdersModule.getAverageOrderValue()
        };
    },
    
    // ==========================================
    // REPORT PERIODICI
    // ==========================================
    
    // Report giornaliero
    getDailyReport(date = new Date()) {
        if (!OrdersModule) return null;
        
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        
        const orders = OrdersModule.orders.filter(o => {
            const orderDate = new Date(o.createdAt);
            return orderDate >= dayStart && orderDate < dayEnd;
        });
        
        return {
            date: Utils.formatDate(date),
            ordersCount: orders.length,
            revenue: orders.reduce((sum, o) => sum + o.totalAmount, 0),
            orders: orders
        };
    },
    
    // Report settimanale
    getWeeklyReport(startDate = new Date()) {
        if (!OrdersModule) return null;
        
        const weekStart = new Date(startDate);
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        
        const orders = OrdersModule.orders.filter(o => {
            const orderDate = new Date(o.createdAt);
            return orderDate >= weekStart && orderDate < weekEnd;
        });
        
        return {
            startDate: Utils.formatDate(weekStart),
            endDate: Utils.formatDate(weekEnd),
            ordersCount: orders.length,
            revenue: orders.reduce((sum, o) => sum + o.totalAmount, 0),
            orders: orders
        };
    },
    
    // Report mensile
    getMonthlyReport(year, month) {
        if (!OrdersModule) return null;
        
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 1);
        
        const orders = OrdersModule.orders.filter(o => {
            const orderDate = new Date(o.createdAt);
            return orderDate >= monthStart && orderDate < monthEnd;
        });
        
        return {
            year: year,
            month: month + 1,
            ordersCount: orders.length,
            revenue: orders.reduce((sum, o) => sum + o.totalAmount, 0),
            orders: orders
        };
    },
    
    // ==========================================
    // TOP PRODOTTI
    // ==========================================
    
    getTopProducts(limit = 10) {
        if (!OrdersModule || !ProductsModule) return [];
        
        const productSales = {};
        
        // Conta vendite per prodotto
        OrdersModule.orders.forEach(order => {
            if (order.status === OrdersModule.ORDER_STATUS.DELIVERED) {
                order.items.forEach(item => {
                    if (!productSales[item.productId]) {
                        productSales[item.productId] = {
                            productId: item.productId,
                            quantity: 0,
                            revenue: 0
                        };
                    }
                    
                    productSales[item.productId].quantity += item.quantity;
                    productSales[item.productId].revenue += (item.price * item.quantity);
                });
            }
        });
        
        // Converti in array e ordina
        const topProducts = Object.values(productSales)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, limit);
        
        // Aggiungi nome prodotto
        return topProducts.map(p => {
            const product = ProductsModule.getProductById(p.productId);
            return {
                ...p,
                productName: product ? product.name : 'Prodotto sconosciuto'
            };
        });
    },
    
    // ==========================================
    // ANALISI TENDENZE
    // ==========================================
    
    // Confronta periodo corrente con precedente
    compareWithPreviousPeriod(days = 30) {
        if (!OrdersModule) return null;
        
        const now = new Date();
        const periodStart = new Date(now);
        periodStart.setDate(now.getDate() - days);
        
        const previousStart = new Date(periodStart);
        previousStart.setDate(previousStart.getDate() - days);
        
        // Periodo corrente
        const currentOrders = OrdersModule.orders.filter(o => {
            const date = new Date(o.createdAt);
            return date >= periodStart && date <= now;
        });
        
        const currentRevenue = currentOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        
        // Periodo precedente
        const previousOrders = OrdersModule.orders.filter(o => {
            const date = new Date(o.createdAt);
            return date >= previousStart && date < periodStart;
        });
        
        const previousRevenue = previousOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        
        // Calcola variazioni
        const ordersChange = currentOrders.length - previousOrders.length;
        const revenueChange = currentRevenue - previousRevenue;
        
        const ordersChangePercent = previousOrders.length > 0 
            ? (ordersChange / previousOrders.length) * 100 
            : 0;
        
        const revenueChangePercent = previousRevenue > 0 
            ? (revenueChange / previousRevenue) * 100 
            : 0;
        
        return {
            current: {
                orders: currentOrders.length,
                revenue: currentRevenue
            },
            previous: {
                orders: previousOrders.length,
                revenue: previousRevenue
            },
            change: {
                orders: ordersChange,
                revenue: revenueChange,
                ordersPercent: ordersChangePercent,
                revenuePercent: revenueChangePercent
            }
        };
    },
    
    // ==========================================
    // EXPORT DATI
    // ==========================================
    
    // Prepara dati per export CSV
    prepareDataForExport() {
        return {
            customers: CustomersModule ? CustomersModule.getAllCustomers() : [],
            orders: OrdersModule ? OrdersModule.getAllOrders() : [],
            products: ProductsModule ? ProductsModule.getAllProducts() : [],
            stats: this.getDashboardStats()
        };
    }
};

// Rendi il modulo disponibile globalmente
window.StatsModule = StatsModule;

console.log("✅ Modulo Statistiche caricato");