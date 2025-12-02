// ============================================
// 🎯 APP PRINCIPALE - COORDINATORE
// ============================================

const App = {

    initialized: false,
    currentTab: 'dashboard',

    // ==========================================
    // INIZIALIZZAZIONE
    // ==========================================

    async init() {
        console.log("🚀 Inizializzazione App...");

        try {
            // 1. Controlla callback Dropbox
            if (window.location.hash.includes('access_token')) {
                Storage.handleDropboxCallback();
            }

            // 2. Inizializza Storage e Dropbox
            Storage.initDropbox();

            // 3. Inizializza tutti i moduli
            await this.initModules();

            // 4. Setup UI
            this.setupUI();

            // 5. Carica tab iniziale
            this.switchTab('dashboard');

            this.initialized = true;
            console.log("✅ App inizializzata con successo!");

            Utils.showToast("✅ App caricata!", "success");

        } catch (error) {
            console.error("❌ Errore inizializzazione:", error);
            Utils.showToast("Errore caricamento app", "error");
        }
    },

    // Inizializza tutti i moduli
    async initModules() {
        console.log("📦 Caricamento moduli...");

        // Ordine importante! Alcuni moduli dipendono da altri
        if (CustomersModule) await CustomersModule.init();
        if (ProductsModule) await ProductsModule.init();
        if (OrdersModule) await OrdersModule.init();
        if (FidelityModule) await FidelityModule.init();
        if (CouponsModule) await CouponsModule.init();
        if (QRModule) QRModule.init();

        console.log("✅ Tutti i moduli caricati");
    },

    // ==========================================
    // GESTIONE TAB/PAGINE
    // ==========================================

    switchTab(tabName) {
        console.log("📑 Switch tab:", tabName);

        this.currentTab = tabName;

        // Nascondi tutti i tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });

        // Mostra il tab selezionato
        const selectedContent = document.getElementById(`${tabName}-content`);
        if (selectedContent) {
            selectedContent.classList.remove('hidden');
        }

        // Aggiorna stato bottoni tab
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active', 'border-blue-500', 'text-blue-600');
            btn.classList.add('border-transparent', 'text-gray-500');
        });

        const selectedBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('active', 'border-blue-500', 'text-blue-600');
            selectedBtn.classList.remove('border-transparent', 'text-gray-500');
        }

        // Carica contenuto del tab
        this.loadTabContent(tabName);

        // Nascondi floating buttons in alcune tab
        this.updateFloatingButtons(tabName);
    },

    loadTabContent(tabName) {
        switch (tabName) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'orders':
                this.loadOrders();
                break;
            case 'customers':
                this.loadCustomers();
                break;
            case 'products':
                this.loadProducts();
                break;
            case 'fidelity':
                this.loadFidelity();
                break;
            case 'settings':
                this.loadSettings();
                break;
        }
    },

    // ==========================================
    // CARICAMENTO CONTENUTI TAB
    // ==========================================

    loadDashboard() {
        console.log("📊 Caricamento dashboard...");

        const stats = StatsModule.getDashboardStats();

        // Aggiorna cards statistiche
        this.updateStatsCards(stats);

        // Carica ordini recenti
        if (OrdersModule) {
            const recentOrders = OrdersModule.getAllOrders('recent').slice(0, 5);
            this.displayRecentOrders(recentOrders);
        }
    },

    updateStatsCards(stats) {
        // Clienti
        if (stats.customers) {
            this.updateElement('stat-customers', stats.customers.total);
        }

        // Ordini
        if (stats.orders) {
            this.updateElement('stat-orders', stats.orders.total);
            this.updateElement('stat-active-orders', stats.orders.active);
            this.updateElement('stat-today-orders', stats.orders.todayOrders);
        }

        // Fatturato
        if (stats.revenue) {
            this.updateElement('stat-revenue', Utils.formatPrice(stats.revenue.total));
            this.updateElement('stat-today-revenue', Utils.formatPrice(stats.revenue.today));
        }

        // Fidelity
        if (stats.fidelity) {
            this.updateElement('stat-fidelity-customers', stats.fidelity.totalCustomers);
            this.updateElement('stat-available-rewards', stats.fidelity.availableRewards);
        }

        // Coupon
        if (stats.coupons) {
            this.updateElement('stat-active-coupons', stats.coupons.activeCoupons);
        }
    },

    displayRecentOrders(orders) {
        const container = document.getElementById('recent-orders-list');
        if (!container) return;

        if (orders.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">Nessun ordine recente</p>';
            return;
        }

        container.innerHTML = orders.map(order => {
            const customer = CustomersModule ?
                CustomersModule.getCustomerById(order.customerId) : null;

            const customerName = customer ?
                `${customer.firstName} ${customer.lastName}` :
                'Cliente sconosciuto';

            return `
                <div class="border-b pb-3 mb-3 last:border-b-0" onclick="app.viewOrderDetails('${order.id}')">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-semibold">${customerName}</p>
                            <p class="text-sm text-gray-600">${order.items.length} prodotti</p>
                        </div>
                        <div class="text-right">
                            <p class="font-bold text-blue-600">${Utils.formatPrice(order.totalAmount)}</p>
                            <p class="text-xs text-gray-500">${Utils.formatDate(order.createdAt)}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    loadOrders() {
        this.displayOrders(OrdersModule.getAllOrders('recent'));
    },

    displayOrders(orders) {
        const container = document.getElementById('orders-list');
        if (!container) return;

        if (orders.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">Nessun ordine</p>';
            return;
        }

        const statusColors = {
            pending: 'bg-yellow-100 text-yellow-800',
            confirmed: 'bg-blue-100 text-blue-800',
            ready: 'bg-green-100 text-green-800',
            delivered: 'bg-gray-100 text-gray-800',
            cancelled: 'bg-red-100 text-red-800'
        };

        const statusNames = {
            pending: 'In attesa',
            confirmed: 'Confermato',
            ready: 'Pronto',
            delivered: 'Consegnato',
            cancelled: 'Annullato'
        };

        container.innerHTML = orders.map(o => {
            const customer = CustomersModule.getCustomerById(o.customerId);
            const customerName = customer ? `${customer.firstName} ${customer.lastName}` : 'Cliente sconosciuto';

            return `
                <div class="bg-white p-4 rounded-lg shadow cursor-pointer" onclick="app.viewOrderDetails('${o.id}')">                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h3 class="font-bold text-lg">${customerName}</h3>
                        <p class="text-sm text-gray-600">${o.items.length} prodotti</p>
                        ${o.deliveryDate ? `<p class="text-sm text-gray-600">📅 ${Utils.formatDate(o.deliveryDate)} ${o.deliveryTime || ''}</p>` : ''}
                    </div>
                    <div class="text-right">
                        <p class="text-2xl font-bold text-blue-600">${Utils.formatPrice(o.totalAmount)}</p>
                        <span class="text-xs px-2 py-1 rounded ${statusColors[o.status]}">${statusNames[o.status]}</span>
                    </div>
                </div>
                
                <div class="flex gap-2 mt-3">
                    ${o.status === 'pending' ? `<button onclick="OrdersModule.changeOrderStatus('${o.id}', 'confirmed'); app.loadOrders()" class="text-xs px-3 py-1 bg-blue-600 text-white rounded">Conferma</button>` : ''}
                    ${o.status === 'confirmed' ? `<button onclick="OrdersModule.changeOrderStatus('${o.id}', 'ready'); app.loadOrders()" class="text-xs px-3 py-1 bg-green-600 text-white rounded">Pronto</button>` : ''}
                    ${o.status === 'ready' ? `<button onclick="OrdersModule.changeOrderStatus('${o.id}', 'delivered'); app.loadOrders()" class="text-xs px-3 py-1 bg-gray-600 text-white rounded">Consegnato</button>` : ''}
                    <button onclick="app.deleteOrder('${o.id}')" class="text-red-600 text-sm ml-auto">🗑️</button>
                </div>
            </div>
        `;
        }).join('');
    },

    filterOrders(status) {
        if (status === 'all') {
            this.displayOrders(OrdersModule.getAllOrders('recent'));
        } else {
            this.displayOrders(OrdersModule.getOrdersByStatus(status));
        }
    },

    openNewOrderModal() {
        console.log("🔵 openNewOrderModal chiamata");
        this.openModal('new-order-modal');

        const select = document.getElementById('order-customer');
        console.log("🔵 Select trovato:", select);

        const customers = CustomersModule.getAllCustomers('name');
        console.log("🔵 Clienti:", customers.length);

        select.innerHTML = '<option value="">-- Seleziona cliente --</option>' +
            customers.map(c => `<option value="${c.id}">${c.firstName} ${c.lastName}</option>`).join('');

        console.log("🔵 Select popolato, innerHTML length:", select.innerHTML.length);

        // Reset form
        document.getElementById('order-items').innerHTML = '';
        document.getElementById('order-delivery-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('order-notes').value = '';
        this.orderItems = [];
        this.updateOrderTotal();
    },

    orderItems: [],

    addOrderItem() {
        const products = ProductsModule.getActiveProducts();
        const itemHtml = `
        <div class="flex gap-2 mb-2 order-item">
            <select class="flex-1 px-2 py-1 border rounded" onchange="app.updateOrderTotal()">
                <option value="">-- Prodotto --</option>
                ${products.map(p => `<option value="${p.id}" data-price="${p.price}" data-weight="${p.averageWeight || 0}">${p.name} - ${Utils.formatPrice(p.price)}/${p.unit || 'kg'}</option>`).join('')}
            </select>
            <input type="number" step="0.01" placeholder="Qtà" class="w-20 px-2 py-1 border rounded" onchange="app.updateOrderTotal()">
            <button onclick="this.parentElement.remove(); app.updateOrderTotal()" class="text-red-600">✕</button>
        </div>
    `;
        document.getElementById('order-items').insertAdjacentHTML('beforeend', itemHtml);
    },

    updateOrderTotal() {
        let total = 0;
        document.querySelectorAll('.order-item').forEach(item => {
            const select = item.querySelector('select');
            const qty = parseFloat(item.querySelector('input').value) || 0;
            if (select.value && qty > 0) {
                const option = select.selectedOptions[0];
                const price = parseFloat(option.dataset.price);
                const weight = parseFloat(option.dataset.weight) || 0;

                if (weight > 0) {
                    total += price * weight * qty;
                } else {
                    total += price * qty;
                }
            }
        });
        document.getElementById('order-total').textContent = Utils.formatPrice(total);
    },

    saveOrder() {
        const customerId = document.getElementById('order-customer').value;
        if (!customerId) {
            Utils.showToast("Seleziona un cliente", "error");
            return;
        }

        const items = [];
        document.querySelectorAll('.order-item').forEach(item => {
            const select = item.querySelector('select');
            const qty = parseFloat(item.querySelector('input').value) || 0;
            if (select.value && qty > 0) {
                const option = select.selectedOptions[0];
                const price = parseFloat(option.dataset.price);
                const weight = parseFloat(option.dataset.weight) || 0;

                items.push({
                    productId: select.value,
                    quantity: weight > 0 ? weight * qty : qty,
                    price: price
                });
            }
        });

        if (items.length === 0) {
            Utils.showToast("Aggiungi almeno un prodotto", "error");
            return;
        }

        OrdersModule.createOrder({
            customerId: customerId,
            items: items,
            deliveryDate: document.getElementById('order-delivery-date').value,
            deliveryTime: document.getElementById('order-delivery-time').value,
            notes: document.getElementById('order-notes').value
        });

        this.closeModal('new-order-modal');
        this.loadOrders();
    },

    deleteOrder(orderId) {
        if (OrdersModule.deleteOrder(orderId)) {
            this.loadOrders();
        }
    },

    viewOrderDetails(orderId) {
        const order = OrdersModule.formatOrderDetails(orderId);
        if (!order) return;

        const content = document.getElementById('order-details-content');
        content.innerHTML = `
        <p class="mb-2"><strong>Cliente:</strong> ${order.customerName}</p>
        <p class="mb-2"><strong>Data consegna:</strong> ${order.deliveryDate ? Utils.formatDate(order.deliveryDate) : '-'} ${order.deliveryTime || ''}</p>
        <p class="mb-4"><strong>Note:</strong> ${order.notes || '-'}</p>
        
        <h4 class="font-bold mb-2">Prodotti:</h4>
        <div class="space-y-1 mb-4">
            ${order.items.map(item => `
                <div class="flex justify-between text-sm">
                    <span>${item.productName} x${item.quantity}</span>
                    <span>${Utils.formatPrice(item.price * item.quantity)}</span>
                </div>
            `).join('')}
        </div>
        
        <div class="text-right">
            <p class="text-2xl font-bold">Totale: ${Utils.formatPrice(order.totalAmount)}</p>
        </div>
    `;

        this.openModal('order-details-modal');
    },

    loadCustomers() {
        console.log("👥 Caricamento clienti...");
        this.displayCustomers(CustomersModule.getAllCustomers());
    },

    displayCustomers(customers) {
        const container = document.getElementById('customers-list');
        if (!container) return;

        if (customers.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">Nessun cliente</p>';
            return;
        }

        container.innerHTML = customers.map(c => `
        <div class="bg-white p-4 rounded-lg shadow hover:shadow-md transition">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <h3 class="font-bold text-lg">${c.firstName} ${c.lastName}</h3>
                    ${c.phone ? `<p class="text-sm text-gray-600">📞 ${c.phone}</p>` : ''}
                    ${c.email ? `<p class="text-sm text-gray-600">📧 ${c.email}</p>` : ''}
                    <p class="text-xs text-gray-500 mt-2">Ordini: ${c.totalOrders || 0} | Speso: ${Utils.formatPrice(c.totalSpent || 0)}</p>
                </div>
                <button onclick="app.deleteCustomer('${c.id}')" class="text-red-600 hover:text-red-800">🗑️</button>
            </div>
        </div>
    `).join('');
    },

    searchCustomers() {
        const query = document.getElementById('customer-search').value;
        const results = CustomersModule.searchCustomers(query);
        this.displayCustomers(results);
    },

    openNewCustomerModal() {
        this.openModal('new-customer-modal');
    },

    saveCustomer(event) {
        event.preventDefault();

        const data = {
            firstName: document.getElementById('customer-firstname').value,
            lastName: document.getElementById('customer-lastname').value,
            phone: document.getElementById('customer-phone').value,
            email: document.getElementById('customer-email').value,
            address: document.getElementById('customer-address').value
        };

        CustomersModule.addCustomer(data);
        this.closeModal('new-customer-modal');
        event.target.reset();
        this.loadCustomers();
    },

    deleteCustomer(customerId) {
        if (CustomersModule.deleteCustomer(customerId)) {
            this.loadCustomers();
        }
    },

    loadProducts() {
        this.displayProducts(ProductsModule.getAllProducts());
    },

    displayProducts(products) {
        const container = document.getElementById('products-list');
        if (!container) return;

        // Raggruppa per categoria
        const byCategory = {};
        products.forEach(p => {
            if (!byCategory[p.category]) byCategory[p.category] = [];
            byCategory[p.category].push(p);
        });

        container.innerHTML = Object.keys(byCategory).sort().map(cat => `
        <div class="col-span-full">
            <h3 class="text-xl font-bold mb-3 text-blue-600">${cat}</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                ${byCategory[cat].map(p => `
                    <div class="bg-white p-4 rounded-lg shadow">
                        <h4 class="font-bold">${p.name}</h4>
                        <p class="text-2xl text-blue-600 font-bold mt-2">${Utils.formatPrice(p.price)}/${p.unit || 'kg'}</p>
                        ${p.averageWeight ? `<p class="text-xs text-gray-500">Peso medio: ${(p.averageWeight * 1000).toFixed(0)}g</p>` : ''}
                        <div class="flex gap-2 mt-3">
                            <button onclick="ProductsModule.toggleProductActive('${p.id}'); app.loadProducts()" class="text-xs px-2 py-1 rounded ${p.active ? 'bg-green-100 text-green-700' : 'bg-gray-100'}">${p.active ? '✓' : '✗'}</button>
                            <button onclick="app.editProduct('${p.id}')" class="text-blue-600 text-sm">✏️</button>
                            <button onclick="app.deleteProduct('${p.id}')" class="text-red-600 text-sm">🗑️</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
    },

    searchProducts() {
        const query = document.getElementById('product-search').value;
        const results = ProductsModule.searchProducts(query);
        this.displayProducts(results);
    },

    openNewProductModal() {
        this.openModal('new-product-modal');
    },

    saveProduct(event) {
        event.preventDefault();
        const unit = document.getElementById('product-unit').value;
        const productId = document.getElementById('product-id').value;

        let category = document.getElementById('product-category').value;
        if (category === '__new__') {
            category = document.getElementById('product-category-new').value;
        }

        const data = {
            name: document.getElementById('product-name').value,
            price: document.getElementById('product-price').value,
            category: category,
            description: document.getElementById('product-description').value,
            unit: unit,
            averageWeight: unit === 'kg (peso medio)' ? parseFloat(document.getElementById('product-weight').value) : null
        };

        if (productId) {
            ProductsModule.updateProduct(productId, data);
        } else {
            ProductsModule.addProduct(data);
        }

        this.closeModal('new-product-modal');
        event.target.reset();
        document.getElementById('product-id').value = '';
        this.loadProducts();
    },

    editProduct(productId) {
        const product = ProductsModule.getProductById(productId);
        if (!product) return;

        document.getElementById('product-id').value = product.id;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-price').value = product.price;

        // Gestione categoria
        const categorySelect = document.getElementById('product-category');
        categorySelect.value = product.category;

        // Se la categoria non esiste nel select, usa "Nuova categoria"
        if (categorySelect.value === '' && product.category) {
            categorySelect.value = '__new__';
            document.getElementById('product-category-new').value = product.category;
            checkNewCategory();
        }

        document.getElementById('product-unit').value = product.unit || 'kg';
        document.getElementById('product-weight').value = product.averageWeight || '';
        document.getElementById('product-description').value = product.description || '';

        toggleWeightInput();
        this.openModal('new-product-modal');
    },

    deleteProduct(productId) {
        if (ProductsModule.deleteProduct(productId)) {
            this.loadProducts();
        }
    },

    loadFidelity() {
        console.log("🎁 Caricamento fidelity...");
        // TODO: Implementare gestione fidelity
    },

    loadSettings() {
        console.log("⚙️ Caricamento impostazioni...");

        // Mostra stato Dropbox
        const statusEl = document.getElementById('dropbox-status');
        if (statusEl) {
            if (Storage.isDropboxConnected) {
                statusEl.innerHTML = '<span class="text-green-600">✅ Connesso</span>';
            } else {
                statusEl.innerHTML = '<span class="text-red-600">❌ Non connesso</span>';
            }
        }
    },

    // ==========================================
    // MODAL MANAGEMENT
    // ==========================================

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    },

    // ==========================================
    // ACTIONS
    // ==========================================

    openNewOrderModal() {
        this.openModal('new-order-modal');

        // Popola select clienti
        const select = document.getElementById('order-customer');
        const customers = CustomersModule.getAllCustomers('name');
        select.innerHTML = '<option value="">-- Seleziona cliente --</option>' +
            customers.map(c => `<option value="${c.id}">${c.firstName} ${c.lastName}</option>`).join('');

        // Reset form
        document.getElementById('order-items').innerHTML = '';
        document.getElementById('order-delivery-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('order-notes').value = '';
        this.orderItems = [];
        this.updateOrderTotal();
    },

    // Visualizza dettagli ordine
    viewOrderDetails(orderId) {
        console.log("👁️ Visualizza ordine:", orderId);
        // TODO: Mostra dettagli ordine in modal
    },

    // Scanner QR Fidelity
    openFidelityQRScanner() {
        this.openModal('fidelity-qr-scanner-modal');

        QRModule.openScanner(
            'fidelity-qr-video',
            (qrData) => this.handleFidelityQRScan(qrData),
            (error) => console.error("Errore scanner:", error)
        );
    },

    closeFidelityQRScanner() {
        QRModule.closeScanner();
        this.closeModal('fidelity-qr-scanner-modal');
    },

    handleFidelityQRScan(qrData) {
        console.log("QR Scansionato:", qrData);

        const result = QRModule.processScannedQR(qrData);

        if (result) {
            // Mostra info cliente e permetti azioni
            Utils.showToast(`Cliente: ${result.customer.firstName}`, "success");
            // TODO: Apri modal con azioni (aggiungi bollini, usa premio, etc.)
        }
    },

    // ==========================================
    // DROPBOX
    // ==========================================

    async connectDropbox() {
        await Storage.connectDropbox();
    },

    disconnectDropbox() {
        if (confirm("Disconnettere Dropbox?")) {
            Storage.disconnectDropbox();
            this.loadSettings();
        }
    },

    async syncWithDropbox() {
        Utils.showToast("🔄 Sincronizzazione in corso...", "info");

        try {
            // Ricarica tutti i dati da Dropbox
            await this.initModules();

            // Ricarica UI
            this.loadTabContent(this.currentTab);

            Utils.showToast("✅ Sincronizzazione completata!", "success");
        } catch (error) {
            console.error("Errore sincronizzazione:", error);
            Utils.showToast("❌ Errore sincronizzazione", "error");
        }
    },

    // ==========================================
    // IMPORT/EXPORT DATI
    // ==========================================

    // Esporta tutti i dati in JSON
    exportData() {
        console.log("📤 Esportazione dati...");

        const data = {
            version: "2.0",
            exportDate: new Date().toISOString(),
            customers: CustomersModule.customers,
            products: ProductsModule.products,
            orders: OrdersModule.orders,
            fidelity: FidelityModule.fidelityCustomers,
            campaigns: CouponsModule.campaigns
        };

        // Converti in JSON
        const json = JSON.stringify(data, null, 2);

        // Crea file e download
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `gestionale-ordini-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Utils.showToast("✅ Dati esportati!", "success");
        console.log("✅ Export completato");
    },

    // Importa dati da JSON
    importData() {
        console.log("📥 Apertura file picker...");

        const fileInput = document.getElementById('import-file-input');

        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                Utils.showToast("📂 Lettura file...", "info");

                const text = await file.text();
                const data = JSON.parse(text);

                console.log("📊 File letto:", data);

                // Controlla se è formato vecchio o nuovo
                if (data.version === "2.0") {
                    // Formato nuovo
                    await this.importNewFormat(data);
                } else {
                    // Formato vecchio (usa TestData)
                    await TestData.importFromOldJSON(data);
                }

                // Reset input
                fileInput.value = '';

            } catch (error) {
                console.error("❌ Errore importazione:", error);
                Utils.showToast("❌ Errore: file non valido", "error");
            }
        };

        fileInput.click();
    },

    // Importa formato nuovo (2.0)
    async importNewFormat(data) {
        console.log("📥 Importazione formato nuovo...");

        if (confirm("⚠️ Questo sovrascriverà i dati esistenti. Continuare?")) {

            // Importa tutto
            if (data.customers) {
                CustomersModule.customers = data.customers;
                await CustomersModule.saveCustomers();
            }

            if (data.products) {
                ProductsModule.products = data.products;
                await ProductsModule.saveProducts();
            }

            if (data.orders) {
                OrdersModule.orders = data.orders;
                await OrdersModule.saveOrders();
            }

            if (data.fidelity) {
                FidelityModule.fidelityCustomers = data.fidelity;
                await FidelityModule.saveFidelity();
            }

            if (data.campaigns) {
                CouponsModule.campaigns = data.campaigns;
                await CouponsModule.saveCampaigns();
            }

            Utils.showToast("✅ Dati importati con successo!", "success");

            // Ricarica app
            this.refresh();
        }
    },

    // ==========================================
    // SETUP UI
    // ==========================================

    setupUI() {
        console.log("🎨 Setup UI...");

        // Setup auto-hide floating buttons
        this.setupFloatingButtons();

        // Setup shortcuts tastiera (per desktop)
        this.setupKeyboardShortcuts();
    },

    setupFloatingButtons() {
        let lastScrollTop = 0;
        const floatingButtons = document.getElementById('floating-buttons');

        if (!floatingButtons) return;

        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

            if (scrollTop > lastScrollTop && scrollTop > 100) {
                // Scroll giù - nascondi
                floatingButtons.style.transform = 'translateY(100px)';
                floatingButtons.style.opacity = '0';
            } else {
                // Scroll su - mostra
                floatingButtons.style.transform = 'translateY(0)';
                floatingButtons.style.opacity = '1';
            }

            lastScrollTop = scrollTop;
        });
    },

    updateFloatingButtons(tabName) {
        const floatingButtons = document.getElementById('floating-buttons');
        if (!floatingButtons) return;

        // Mostra solo in alcune tab
        if (['dashboard', 'orders', 'fidelity'].includes(tabName)) {
            floatingButtons.style.display = 'flex';
        } else {
            floatingButtons.style.display = 'none';
        }
    },

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + numero = switch tab
            if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '6') {
                e.preventDefault();
                const tabs = ['dashboard', 'orders', 'customers', 'products', 'fidelity', 'settings'];
                const index = parseInt(e.key) - 1;
                if (tabs[index]) {
                    this.switchTab(tabs[index]);
                }
            }
        });
    },

    // ==========================================
    // UTILITY
    // ==========================================

    updateElement(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    },

    refresh() {
        console.log("🔄 Refresh app...");
        this.loadTabContent(this.currentTab);
    }
};

// Rendi App disponibile globalmente
window.app = App;

// Auto-inizializzazione quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

console.log("✅ App.js caricato");