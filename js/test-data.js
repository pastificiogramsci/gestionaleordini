// ============================================
// 🧪 DATI DI TEST
// ============================================
// Questo file popola l'app con dati di esempio
// IMPORTANTE: Esegui solo UNA VOLTA per non duplicare!

const TestData = {
    
    // Flag per evitare di eseguire più volte
    initialized: false,
    
    async populate() {
        if (this.initialized) {
            console.log("⚠️ Dati di test già caricati!");
            return;
        }
        
        console.log("🧪 Caricamento dati di test...");
        
        // 1. Aggiungi clienti
        await this.addCustomers();
        
        // 2. Aggiungi prodotti
        await this.addProducts();
        
        // 3. Aggiungi ordini
        await this.addOrders();
        
        // 4. Aggiungi fidelity
        await this.addFidelity();
        
        // 5. Aggiungi campagne coupon
        await this.addCampaigns();
        
        this.initialized = true;
        
        console.log("✅ Dati di test caricati!");
        Utils.showToast("✅ Dati di test caricati!", "success");
        
        // Ricarica la dashboard
        if (app) {
            app.refresh();
        }
    },
    
    async addCustomers() {
        const customers = [
            {
                firstName: "Mario",
                lastName: "Rossi",
                phone: "3331234567",
                email: "mario.rossi@email.it",
                address: "Via Roma 123, Torino"
            },
            {
                firstName: "Laura",
                lastName: "Bianchi",
                phone: "3339876543",
                email: "laura.bianchi@email.it",
                address: "Corso Francia 45, Torino"
            },
            {
                firstName: "Giuseppe",
                lastName: "Verdi",
                phone: "3335551234",
                email: "g.verdi@email.it",
                address: "Via Po 78, Torino"
            },
            {
                firstName: "Anna",
                lastName: "Neri",
                phone: "3337778888",
                email: "anna.neri@email.it",
                address: "Via Garibaldi 56, Torino"
            }
        ];
        
        for (const customer of customers) {
            CustomersModule.addCustomer(customer);
        }
        
        console.log("👥 4 clienti aggiunti");
    },
    
    async addProducts() {
        const products = [
            {
                name: "Tagliatelle fresche",
                price: 4.50,
                category: "Pasta Fresca",
                description: "250g di tagliatelle all'uovo"
            },
            {
                name: "Ravioli ricotta e spinaci",
                price: 6.00,
                category: "Pasta Ripiena",
                description: "300g di ravioli artigianali"
            },
            {
                name: "Pappardelle al tartufo",
                price: 8.50,
                category: "Pasta Fresca",
                description: "250g di pappardelle con tartufo"
            },
            {
                name: "Gnocchi di patate",
                price: 5.00,
                category: "Gnocchi",
                description: "500g di gnocchi freschi"
            },
            {
                name: "Tortellini alla carne",
                price: 7.50,
                category: "Pasta Ripiena",
                description: "300g di tortellini bolognesi"
            },
            {
                name: "Sugo al ragù",
                price: 6.50,
                category: "Sughi",
                description: "Barattolo 300ml"
            }
        ];
        
        for (const product of products) {
            ProductsModule.addProduct(product);
        }
        
        console.log("🍝 6 prodotti aggiunti");
    },
    
    async addOrders() {
        const customers = CustomersModule.getAllCustomers();
        const products = ProductsModule.getAllProducts();
        
        if (customers.length === 0 || products.length === 0) {
            console.log("⚠️ Impossibile creare ordini: mancano clienti o prodotti");
            return;
        }
        
        // Ordine 1 - Mario Rossi
        OrdersModule.createOrder({
            customerId: customers[0].id,
            items: [
                { productId: products[0].id, quantity: 2, price: products[0].price },
                { productId: products[5].id, quantity: 1, price: products[5].price }
            ],
            deliveryDate: new Date().toISOString().split('T')[0],
            deliveryTime: "18:00",
            notes: "Suonare al citofono"
        });
        
        // Ordine 2 - Laura Bianchi
        OrdersModule.createOrder({
            customerId: customers[1].id,
            items: [
                { productId: products[1].id, quantity: 3, price: products[1].price },
                { productId: products[3].id, quantity: 1, price: products[3].price }
            ],
            deliveryDate: new Date().toISOString().split('T')[0],
            deliveryTime: "19:30",
            notes: ""
        });
        
        // Ordine 3 - Giuseppe Verdi
        const order3 = OrdersModule.createOrder({
            customerId: customers[2].id,
            items: [
                { productId: products[2].id, quantity: 1, price: products[2].price },
                { productId: products[4].id, quantity: 2, price: products[4].price }
            ],
            deliveryDate: new Date().toISOString().split('T')[0],
            deliveryTime: "20:00",
            notes: "Ordine urgente"
        });
        
        // Marca un ordine come consegnato
        OrdersModule.changeOrderStatus(order3.id, OrdersModule.ORDER_STATUS.DELIVERED);
        
        console.log("📦 3 ordini aggiunti");
    },
    
    async addFidelity() {
        const customers = CustomersModule.getAllCustomers();
        
        if (customers.length === 0) return;
        
        // Registra i primi 3 clienti nel programma fidelity
        for (let i = 0; i < Math.min(3, customers.length); i++) {
            FidelityModule.registerCustomer(customers[i].id);
            
            // Aggiungi bollini casuali
            const stamps = Math.floor(Math.random() * 15) + 5;
            FidelityModule.addStamps(customers[i].id, stamps);
        }
        
        console.log("🎁 Fidelity configurato per 3 clienti");
    },
    
    async addCampaigns() {
        const today = new Date();
        const nextMonth = new Date(today);
        nextMonth.setMonth(today.getMonth() + 1);
        
        CouponsModule.createCampaign({
            name: "Sconto Natale 2025",
            description: "20% di sconto per Natale",
            discountType: "percentage",
            discountValue: 20,
            startDate: today.toISOString().split('T')[0],
            endDate: nextMonth.toISOString().split('T')[0]
        });
        
        console.log("🎫 1 campagna coupon creata");
    },
    
    // Resetta tutti i dati (usa con cautela!)
    async reset() {
        if (!confirm("⚠️ ATTENZIONE: Questo cancellerà TUTTI i dati. Continuare?")) {
            return;
        }
        
        CustomersModule.customers = [];
        ProductsModule.products = [];
        OrdersModule.orders = [];
        FidelityModule.fidelityCustomers = [];
        CouponsModule.campaigns = [];
        
        await CustomersModule.saveCustomers();
        await ProductsModule.saveProducts();
        await OrdersModule.saveOrders();
        await FidelityModule.saveFidelity();
        await CouponsModule.saveCampaigns();
        
        this.initialized = false;
        
        console.log("🗑️ Tutti i dati cancellati");
        Utils.showToast("Dati cancellati", "info");
        
        if (app) {
            app.refresh();
        }
    }
};

// Rendi disponibile globalmente
window.TestData = TestData;

console.log("✅ Test Data caricato");
console.log("💡 Usa: TestData.populate() per caricare dati di test");
console.log("💡 Usa: TestData.reset() per cancellare tutto");