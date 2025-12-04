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
    },

    // ==========================================
    // IMPORTAZIONE DA FILE JSON VECCHIO
    // ==========================================

    async importFromOldJSON(jsonData) {
        console.log('📥 Importazione dati dal vecchio sistema...');

        if (!jsonData.data) {
            Utils.showToast("❌ Formato file non valido", "error");
            return;
        }

        const data = jsonData.data;

        // CLIENTI
        if (data.clienti && data.clienti.length > 0) {
            const customers = data.clienti.map(c => ({
                id: c.id || Utils.generateId(),
                firstName: c.nome || '',
                lastName: c.cognome || '',
                phone: c.telefono || '',
                email: c.email || '',
                address: c.indirizzo || '',
                createdAt: c.dataRegistrazione || new Date().toISOString(),
                totalOrders: 0,
                totalSpent: 0
            }));

            CustomersModule.customers = customers;
            await CustomersModule.saveCustomers();
            console.log(`✅ Importati ${customers.length} clienti`);
        }

        // PRODOTTI
        if (data.prodotti && data.prodotti.length > 0) {
            const products = data.prodotti.map(p => ({
                id: p.id || Utils.generateId(),
                name: p.nome || '',
                category: p.categoria || 'Generale',
                price: parseFloat(p.prezzo) || 0,
                unit: p.unita || 'kg',
                averageWeight: p.pesoMedio ? parseFloat(p.pesoMedio) : null,
                description: p.descrizione || '',
                active: p.attivo !== false,
                createdAt: p.dataCreazione || new Date().toISOString()
            }));

            ProductsModule.products = products;
            await ProductsModule.saveProducts();
            console.log(`✅ Importati ${products.length} prodotti`);
        }

        // ORDINI
        if (data.ordini && data.ordini.length > 0) {
            const orders = data.ordini.map(o => ({
                id: o.id || Utils.generateId(),
                orderNumber: o.numeroOrdine || '',
                customerId: o.clienteId || '',
                items: o.prodotti ? o.prodotti.map(item => ({
                    productId: item.prodottoId || '',
                    quantity: parseFloat(item.quantita) || 0,
                    price: parseFloat(item.prezzo) || 0,
                    prepared: item.preparato || false
                })) : [],
                totalAmount: parseFloat(o.totale) || 0,
                status: o.stato || 'pending',
                deliveryDate: o.dataConsegna || '',
                deliveryTime: o.oraConsegna || '',
                notes: o.note || '',
                createdAt: o.dataCreazione || new Date().toISOString(),
                updatedAt: o.dataModifica || new Date().toISOString()
            }));

            OrdersModule.orders = orders;
            await OrdersModule.saveOrders();
            console.log(`✅ Importati ${orders.length} ordini`);
        }

        // FIDELITY
        if (data.fidelity && data.fidelity.length > 0) {
            FidelityModule.fidelityCustomers = data.fidelity;
            await FidelityModule.saveFidelity();
            console.log(`✅ Importati ${data.fidelity.length} clienti fidelity`);
        }

        Utils.showToast("✅ Dati importati con successo!", "success");

        // Ricarica tutto
        await CustomersModule.init();
        await ProductsModule.init();
        await OrdersModule.init();
        await FidelityModule.init();

        console.log('✅ Importazione completata!');
    }
    
    async importProducts(oldProducts) {
        console.log(`📦 Importazione ${oldProducts.length} prodotti...`);

        for (const oldProduct of oldProducts) {
            const newProduct = {
                id: oldProduct.id,
                name: oldProduct.name,
                price: oldProduct.price,
                category: oldProduct.category || 'Altro',
                description: oldProduct.unit ? `Venduto a ${oldProduct.unit}` : '',
                active: true,
                createdAt: new Date().toISOString()
            };

            // Controlla se esiste già
            const existing = ProductsModule.getProductById(oldProduct.id);
            if (!existing) {
                ProductsModule.products.push(newProduct);
            }
        }

        await ProductsModule.saveProducts();
        console.log(`✅ ${oldProducts.length} prodotti importati`);
    },

    async importCustomers(oldCustomers) {
        console.log(`👥 Importazione ${oldCustomers.length} clienti...`);

        for (const oldCustomer of oldCustomers) {
            const newCustomer = {
                id: oldCustomer.id,
                firstName: oldCustomer.firstName,
                lastName: oldCustomer.lastName,
                phone: oldCustomer.phone || '',
                email: oldCustomer.email || '',
                address: '',
                notes: oldCustomer.marketing ? 'Marketing: Sì' : '',
                createdAt: new Date().toISOString(),
                totalOrders: 0,
                totalSpent: 0
            };

            // Controlla se esiste già
            const existing = CustomersModule.getCustomerById(oldCustomer.id);
            if (!existing) {
                CustomersModule.customers.push(newCustomer);
            }

            // Importa dati fidelity se presenti
            if (oldCustomer.fidelity && oldCustomer.fidelity.stamps > 0) {
                await this.importFidelity(oldCustomer);
            }
        }

        await CustomersModule.saveCustomers();
        console.log(`✅ ${oldCustomers.length} clienti importati`);
    },

    async importFidelity(oldCustomer) {
        // Registra nel sistema fidelity se non già presente
        let fidelity = FidelityModule.getFidelityCustomer(oldCustomer.id);

        if (!fidelity) {
            fidelity = FidelityModule.registerCustomer(oldCustomer.id);
        }

        // Imposta bollini
        fidelity.stamps = oldCustomer.fidelity.stamps || 0;
        fidelity.totalStamps = oldCustomer.fidelity.totalSpent || 0;

        // Converti cronologia
        if (oldCustomer.fidelity.history) {
            fidelity.history = oldCustomer.fidelity.history.map(h => ({
                id: Utils.generateId(),
                type: h.type,
                stamps: h.stamps || 0,
                date: h.date
            }));
        }

        // Converti premi
        if (oldCustomer.fidelity.rewardsList) {
            fidelity.rewards = oldCustomer.fidelity.rewardsList.map(r => ({
                id: Utils.generateId(),
                description: r.description || CONFIG.FIDELITY.DEFAULT_REWARD,
                earnedAt: r.date,
                redeemed: r.claimed || false,
                redeemedAt: r.claimedDate
            }));
        }

        await FidelityModule.saveFidelity();
    },

    async importOrders(oldOrders) {
        console.log(`📦 Importazione ${oldOrders.length} ordini...`);

        for (const oldOrder of oldOrders) {
            // Converti items
            const items = oldOrder.items.map(item => ({
                productId: item.productId,
                quantity: item.qty,
                price: item.price / item.qty // Prezzo unitario
            }));

            // Calcola totale
            const totalAmount = oldOrder.items.reduce((sum, item) => sum + item.price, 0);

            // Converti stato
            let status = 'pending';
            if (oldOrder.prepStatus === 'pronto') status = 'ready';
            if (oldOrder.prepStatus === 'consegnato') status = 'delivered';

            const newOrder = {
                id: oldOrder.id,
                customerId: oldOrder.customerId,
                items: items,
                totalAmount: totalAmount,
                status: status,
                deliveryDate: oldOrder.deliveryDate,
                deliveryTime: null,
                notes: oldOrder.number ? `Numero ordine: ${oldOrder.number}` : '',
                createdAt: oldOrder.createdDate ? new Date(oldOrder.createdDate).toISOString() : new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Controlla se esiste già
            const existing = OrdersModule.getOrderById(oldOrder.id);
            if (!existing) {
                OrdersModule.orders.push(newOrder);
            }
        }

        await OrdersModule.saveOrders();
        console.log(`✅ ${oldOrders.length} ordini importati`);
    }

};

// Rendi disponibile globalmente
window.TestData = TestData;

console.log("✅ Test Data caricato");
console.log("💡 Usa: TestData.populate() per caricare dati di test");
console.log("💡 Usa: TestData.reset() per cancellare tutto");