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
            this.updateLoaderStatus("Controllo autenticazione...");

            // 1. Callback Dropbox
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('code')) {
                console.log("🔵 Trovato code Dropbox, processo callback...");
                await Storage.checkDropboxCallback();
            }

            // 2. Controlla autenticazione
            if (!AuthManager.init()) {
                console.log("🔒 Autenticazione richiesta");
                this.hideLoader();
                return;
            }

            console.log("✅ Autenticato");
            this.hideAuthScreen();

            // 3. Inizializza Storage e Dropbox
            this.updateLoaderStatus("Connessione a Dropbox...");
            await Storage.initDropbox();

            // 4. Download dati da Dropbox (parallelo con fallback)
            if (Storage.dropboxClient) {
                this.updateLoaderStatus("Download dati da cloud...");

                try {
                    // Prova PARALLELO (veloce)
                    const [cloudCustomers, cloudProducts, cloudOrders, cloudFidelity, cloudCampaigns] =
                        await Promise.all([
                            Storage.loadDropbox(CONFIG.DROPBOX_PATHS.CUSTOMERS),
                            Storage.loadDropbox(CONFIG.DROPBOX_PATHS.PRODUCTS),
                            Storage.loadDropbox(CONFIG.DROPBOX_PATHS.ORDERS),
                            Storage.loadDropbox(CONFIG.DROPBOX_PATHS.FIDELITY),
                            Storage.loadDropbox(CONFIG.DROPBOX_PATHS.CAMPAIGNS)
                        ]);

                    // Helper per estrarre data dal nuovo formato {data, metadata} o vecchio formato
                    const extractData = (cloudData) => {
                        if (!cloudData) return null;
                        if (cloudData.data && Array.isArray(cloudData.data)) return cloudData.data;
                        if (Array.isArray(cloudData)) return cloudData;
                        return null;
                    };

                    const customersData = extractData(cloudCustomers);
                    const productsData = extractData(cloudProducts);
                    const ordersData = extractData(cloudOrders);
                    const fidelityData = extractData(cloudFidelity);
                    const campaignsData = extractData(cloudCampaigns);

                    if (customersData && customersData.length > 0) {
                        CustomersModule.customers = customersData;
                        Storage.saveLocal(CONFIG.STORAGE_KEYS.CUSTOMERS, customersData);
                        console.log(`📥 Caricati ${customersData.length} clienti da Dropbox`);
                    }

                    if (productsData && productsData.length > 0) {
                        ProductsModule.products = productsData;
                        Storage.saveLocal(CONFIG.STORAGE_KEYS.PRODUCTS, productsData);
                        console.log(`📥 Caricati ${productsData.length} prodotti da Dropbox`);
                    }

                    if (ordersData && ordersData.length > 0) {
                        OrdersModule.orders = ordersData;
                        Storage.saveLocal(CONFIG.STORAGE_KEYS.ORDERS, ordersData);
                        console.log(`📥 Caricati ${ordersData.length} ordini da Dropbox`);
                    }

                    if (fidelityData && fidelityData.length > 0) {
                        FidelityModule.fidelityCustomers = fidelityData;
                        Storage.saveLocal(CONFIG.STORAGE_KEYS.FIDELITY, fidelityData);
                        console.log(`📥 Caricati ${fidelityData.length} clienti fidelity da Dropbox`);
                    }

                    if (campaignsData && campaignsData.length > 0) {
                        CouponsModule.campaigns = campaignsData;
                        Storage.saveLocal(CONFIG.STORAGE_KEYS.CAMPAIGNS, campaignsData);
                        console.log(`📥 Caricate ${campaignsData.length} campagne da Dropbox`);
                    }

                    console.log("✅ Dati sincronizzati (parallelo)");

                } catch (error) {
                    // Fallback SEQUENZIALE se parallelo fallisce
                    console.warn("⚠️ Parallelo fallito, provo sequenziale...", error);
                    this.updateLoaderStatus("Connessione lenta, download in corso...");

                    const cloudCustomers = await Storage.loadDropbox(CONFIG.DROPBOX_PATHS.CUSTOMERS);
                    const cloudProducts = await Storage.loadDropbox(CONFIG.DROPBOX_PATHS.PRODUCTS);
                    const cloudOrders = await Storage.loadDropbox(CONFIG.DROPBOX_PATHS.ORDERS);
                    const cloudFidelity = await Storage.loadDropbox(CONFIG.DROPBOX_PATHS.FIDELITY);
                    const cloudCampaigns = await Storage.loadDropbox(CONFIG.DROPBOX_PATHS.CAMPAIGNS);

                    // Helper per estrarre data
                    const extractData = (cloudData) => {
                        if (!cloudData) return null;
                        if (cloudData.data && Array.isArray(cloudData.data)) return cloudData.data;
                        if (Array.isArray(cloudData)) return cloudData;
                        return null;
                    };

                    const customersData = extractData(cloudCustomers);
                    const productsData = extractData(cloudProducts);
                    const ordersData = extractData(cloudOrders);
                    const fidelityData = extractData(cloudFidelity);
                    const campaignsData = extractData(cloudCampaigns);

                    if (customersData && customersData.length > 0) {
                        CustomersModule.customers = customersData;
                        Storage.saveLocal(CONFIG.STORAGE_KEYS.CUSTOMERS, customersData);
                    }

                    if (productsData && productsData.length > 0) {
                        ProductsModule.products = productsData;
                        Storage.saveLocal(CONFIG.STORAGE_KEYS.PRODUCTS, productsData);
                    }

                    if (ordersData && ordersData.length > 0) {
                        OrdersModule.orders = ordersData;
                        Storage.saveLocal(CONFIG.STORAGE_KEYS.ORDERS, ordersData);
                    }

                    if (fidelityData && fidelityData.length > 0) {
                        FidelityModule.fidelityCustomers = fidelityData;
                        Storage.saveLocal(CONFIG.STORAGE_KEYS.FIDELITY, fidelityData);
                    }

                    if (campaignsData && campaignsData.length > 0) {
                        CouponsModule.campaigns = campaignsData;
                        Storage.saveLocal(CONFIG.STORAGE_KEYS.CAMPAIGNS, campaignsData);
                    }

                    console.log("✅ Dati sincronizzati (sequenziale)");
                }
            }

            // 5. Inizializza moduli
            this.updateLoaderStatus("Caricamento moduli...");
            await this.initModules();

            // 6. Setup UI
            this.updateLoaderStatus("Preparazione interfaccia...");
            this.setupUI();

            // Chiudi dropdown clienti quando clicchi fuori
            document.addEventListener('click', (e) => {
                const searchInput = document.getElementById('order-customer-search');
                const listContainer = document.getElementById('order-customer-list');

                if (searchInput && listContainer &&
                    !searchInput.contains(e.target) &&
                    !listContainer.contains(e.target)) {
                    listContainer.classList.add('hidden');
                }
            });

            // 7. Carica tab iniziale
            this.switchTab('dashboard');

            this.initialized = true;
            console.log("✅ App inizializzata con successo!");

            // 8. NASCONDI LOADER
            this.hideLoader();
            Utils.showToast("✅ App caricata con successo!", "success");

        } catch (error) {
            console.error("❌ Errore inizializzazione:", error);
            this.hideLoader();
            Utils.showToast("Errore caricamento app", "error");
        }
    },

    updateLoaderStatus(message) {
        const statusEl = document.getElementById('loader-status');
        if (statusEl) statusEl.textContent = message;
    },

    hideLoader() {
        const loader = document.getElementById('app-loader');
        if (loader) loader.style.display = 'none';
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

    handleLogin(event) {
        event.preventDefault();

        const password = document.getElementById('login-password').value;
        const remember = document.getElementById('remember-me').checked;

        if (AuthManager.login(password, remember)) {
            this.hideAuthScreen();
            this.init();
        } else {
            document.getElementById('login-error').textContent = '❌ Password errata';
            document.getElementById('login-error').classList.remove('hidden');
        }
    },

    hideAuthScreen() {
        document.getElementById('auth-screen').style.display = 'none';
    },

    logout() {
        if (confirm('Sei sicuro di voler uscire?')) {
            AuthManager.logout();
        }
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

    },

    loadTabContent(tabName) {
        switch (tabName) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'orders':
                const orderDateFilter = document.getElementById('order-date-filter');
                if (orderDateFilter && !orderDateFilter.value) {
                    orderDateFilter.value = this.getTomorrowDate();
                }
                this.populateYearFilter();
                this.applyOrderFilters();
                break;
            case 'preparation':
                const prepDate = document.getElementById('prep-date');
                if (prepDate && !prepDate.value) {
                    prepDate.value = this.getTomorrowDate();
                }
                this.loadPreparation();
                break;
            case 'modifiche':
                const modDate = document.getElementById('mod-date-filter');
                if (modDate && !modDate.value) {
                    modDate.value = this.getTomorrowDate();
                }
                this.loadModifications();
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
            case 'coupon':
                this.loadCoupons();
                break;
        }
    },

    getTomorrowDate() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
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

        // Stats Fidelity
        const fidelityStats = FidelityModule.getFidelityStats();
        // Aggiungi card o aggiorna esistente se serve
    },

    updateStatsCards(stats) {
        // Ordini
        if (stats.orders) {
            this.updateElement('stat-orders', stats.orders.total);
            this.updateElement('stat-active-orders', stats.orders.active);
            this.updateElement('stat-today-orders', stats.orders.todayOrders);

            // Stati ordini con percentuali
            const total = stats.orders.total || 1; // evita divisione per 0
            this.updateElement('stat-pending-orders', stats.orders.byStatus?.pending || 0);
            this.updateElement('stat-pending-percent', `(${((stats.orders.byStatus?.pending || 0) / total * 100).toFixed(0)}%)`);

            this.updateElement('stat-preparation-orders', stats.orders.byStatus?.in_preparation || 0);
            this.updateElement('stat-preparation-percent', `(${((stats.orders.byStatus?.in_preparation || 0) / total * 100).toFixed(0)}%)`);

            this.updateElement('stat-ready-orders', stats.orders.byStatus?.ready || 0);
            this.updateElement('stat-ready-percent', `(${((stats.orders.byStatus?.ready || 0) / total * 100).toFixed(0)}%)`);

            this.updateElement('stat-delivered-orders', stats.orders.byStatus?.delivered || 0);
            this.updateElement('stat-delivered-percent', `(${((stats.orders.byStatus?.delivered || 0) / total * 100).toFixed(0)}%)`);

            this.updateElement('stat-to-prepare', stats.orders.byStatus?.pending || 0);
        }

        // Clienti
        if (stats.customers) {
            this.updateElement('stat-customers', stats.customers.total);
        }

        // Prodotti
        if (stats.products) {
            this.updateElement('stat-active-products', stats.products.active);
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

        // Top clienti
        this.updateTopCustomers();
    },

    updateTopCustomers() {
        const customers = CustomersModule.getAllCustomers()
            .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
            .slice(0, 5);

        const container = document.getElementById('top-customers-list');
        if (!container) return;

        if (customers.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 py-4">Nessun ordine ancora</p>';
            return;
        }

        container.innerHTML = customers.map((c, i) => `
        <div class="flex items-center justify-between py-3 border-b last:border-b-0">
            <div class="flex items-center gap-3">
                <span class="text-2xl font-bold text-gray-300">${i + 1}</span>
                <div>
                    <p class="font-bold">${c.firstName} ${c.lastName}</p>
                    <p class="text-sm text-gray-600">${c.totalOrders || 0} ordini</p>
                </div>
            </div>
            <div class="text-right">
                <p class="font-bold text-green-600">${Utils.formatPrice(c.totalSpent || 0)}</p>
            </div>
        </div>
    `).join('');
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
        this.populateYearFilter();
        this.updateOrdersStats();
    },

    updateOrdersStats() {
        const orders = OrdersModule.getAllOrders('recent');
        const today = new Date().toISOString().split('T')[0];

        // Stats header
        const todayOrders = orders.filter(o => o.deliveryDate === today).length;
        const pending = orders.filter(o => o.status === 'pending').length;
        const preparation = orders.filter(o => o.status === 'in_preparation').length;
        const ready = orders.filter(o => o.status === 'ready').length;
        const delivered = orders.filter(o => o.status === 'delivered').length;

        this.updateElement('orders-stat-today', todayOrders);
        this.updateElement('orders-stat-pending', pending);
        this.updateElement('orders-stat-preparation', preparation);
        this.updateElement('orders-stat-ready', ready);

        // Contatori bottoni filtro
        this.updateElement('count-all', orders.length);
        this.updateElement('count-pending', pending);
        this.updateElement('count-in_preparation', preparation);
        this.updateElement('count-ready', ready);
        this.updateElement('count-delivered', delivered);
    },

    async addAllCustomersToFidelity() {
        const customers = CustomersModule.getAllCustomers();
        let added = 0;

        for (const customer of customers) {
            const existing = FidelityModule.fidelityCustomers.find(fc => fc.customerId === customer.id);
            if (!existing) {
                FidelityModule.addCustomerToFidelity(customer.id);
                added++;
            }
        }

        Utils.showToast(`✅ ${added} clienti aggiunti a Fidelity!`, "success");
        this.loadFidelity();
    },

    async removeDuplicateCustomers() {
        const customers = CustomersModule.getAllCustomers();
        const seen = new Map(); // phone -> customer
        const duplicates = [];

        customers.forEach(c => {
            const phone = (c.phone || '').replace(/\s+/g, '');

            if (phone && seen.has(phone)) {
                // Duplicato trovato
                duplicates.push({
                    keep: seen.get(phone),
                    duplicate: c
                });
            } else if (phone) {
                seen.set(phone, c);
            }
        });

        if (duplicates.length === 0) {
            Utils.showToast("✅ Nessun duplicato trovato!", "success");
            return;
        }

        const message = `Trovati ${duplicates.length} duplicati:\n\n` +
            duplicates.map(d => `- ${d.duplicate.firstName} ${d.duplicate.lastName} (${d.duplicate.phone})`).join('\n') +
            `\n\nVuoi eliminare i duplicati? (Verrà tenuto il primo)`;

        if (!confirm(message)) return;

        // Elimina duplicati
        duplicates.forEach(d => {
            CustomersModule.deleteCustomer(d.duplicate.id);
        });

        Utils.showToast(`✅ Eliminati ${duplicates.length} duplicati!`, "success");
        this.loadCustomers();
    },

    async resetAllFidelity() {
        const confirm1 = confirm("⚠️ Vuoi azzerare TUTTI i dati Fidelity?\n\nQuesta azione è irreversibile!");
        if (!confirm1) return;

        FidelityModule.fidelityCustomers = [];
        await FidelityModule.saveFidelity();

        this.loadFidelity();
        Utils.showToast("✅ Dati Fidelity azzerati", "success");
    },

    displayFidelityCustomers(fidelityList) {
        const container = document.getElementById('fidelity-customers-list');
        if (!container) return;

        if (fidelityList.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 py-8">Nessun cliente fidelity</p>';
            return;
        }

        container.innerHTML = fidelityList.map(f => {
            const customer = CustomersModule.getCustomerById(f.customerId);
            if (!customer) return '';

            const progress = FidelityModule.getProgressToNextReward(f.customerId);
            const available = FidelityModule.getAvailableRewards(f.customerId).length;
            const redeemed = FidelityModule.getRedeemedRewards(f.customerId).length;

            return `
            <div class="bg-white rounded-lg shadow-lg p-4">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h3 class="text-lg font-bold">${customer.firstName} ${customer.lastName}</h3>
                        <p class="text-sm text-gray-600">${customer.phone || ''}</p>
                    </div>
                    <div class="text-right">
                        <span class="text-2xl font-bold text-purple-600">${f.stamps} ⭐</span>
                        ${available > 0 ? `<span class="ml-2 bg-green-500 text-white px-2 py-1 rounded-full text-sm font-bold">${available} 🎁</span>` : ''}
                    </div>
                </div>
                
                <div class="mb-3">
                    <p class="text-xs text-gray-600 mb-1">Prossimo premio: ${progress.current}/${progress.needed} bollini</p>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-purple-600 h-2 rounded-full" style="width: ${progress.percentage}%"></div>
                    </div>
                </div>
                
                <div class="grid grid-cols-3 gap-2 text-xs mb-3">
                    <div class="bg-green-50 p-2 rounded text-center cursor-pointer" onclick="app.showAvailableRewards('${f.customerId}')">
                        <p class="font-bold text-green-600">${available}</p>
                        <p class="text-gray-600">Premi disponibili</p>
                    </div>
                    <div class="bg-gray-50 p-2 rounded text-center">
                        <p class="font-bold">${redeemed}</p>
                        <p class="text-gray-600">Premi riscattati</p>
                    </div>
                    <div class="bg-blue-50 p-2 rounded text-center cursor-pointer hover:bg-blue-100" onclick="app.openCustomerCoupons('${f.customerId}')">
                        <p class="font-bold text-blue-600">${customer.coupons?.filter(c => !c.used).length || 0}</p>
                        <p class="text-gray-600">Coupon attivi</p>
                    </div>
                </div>
                
                <div class="grid grid-cols-3 gap-2">
                    <button onclick="app.openFidelityDetail('${f.customerId}')" class="bg-purple-600 text-white py-2 rounded text-sm font-medium">Aggiungi Bollini</button>
                    <button onclick="app.generateFidelityCard('${f.customerId}')" class="bg-blue-600 text-white py-2 rounded text-sm font-medium">📱 Tessera</button>
                    <button onclick="app.deleteFidelityCustomer('${f.customerId}')" class="bg-red-600 text-white py-2 rounded text-sm font-medium">🗑️ Elimina</button>
                </div>
            </div>
        `;
        }).join('');
    },

    openFidelityDetail(customerId) {
        this.currentFidelityCustomer = customerId;
        const customer = CustomersModule.getCustomerById(customerId);
        const fidelity = FidelityModule.getFidelityCustomer(customerId);

        if (!customer || !fidelity) return;

        document.getElementById('fidelity-customer-name').textContent = `${customer.firstName} ${customer.lastName}`;
        document.getElementById('fidelity-customer-phone').textContent = customer.phone || '';
        document.getElementById('fidelity-detail-stamps').textContent = fidelity.totalStamps;

        const available = FidelityModule.getAvailableRewards(customerId);
        const redeemed = FidelityModule.getRedeemedRewards(customerId);

        document.getElementById('fidelity-detail-available').textContent = available.length;
        document.getElementById('fidelity-detail-redeemed').textContent = redeemed.length;

        const progress = FidelityModule.getProgressToNextReward(customerId);
        document.getElementById('fidelity-detail-progress').textContent = `${progress.current}/${progress.needed}`;
        document.getElementById('fidelity-detail-bar').style.width = `${progress.percentage}%`;
        document.getElementById('fidelity-detail-missing').textContent = `Mancano ${progress.needed - progress.current} bollini al prossimo premio`;

        // Coupon attivi
        const coupons = customer.coupons?.filter(c => !c.used) || [];
        const couponsHtml = coupons.length > 0 ? `
        <div class="bg-pink-50 border border-pink-200 rounded p-3">
            <h4 class="font-bold mb-2">🎫 Coupon Attivi (${coupons.length})</h4>
            ${coupons.map(c => `<p class="text-sm">• ${c.campaignName}</p>`).join('')}
        </div>
        ` : '';

        document.getElementById('fidelity-detail-coupons').innerHTML = couponsHtml;

        this.openModal('fidelity-detail-modal');
    },

    openCustomerCoupons(customerId) {
        this.currentCouponCustomer = customerId;
        const customer = CustomersModule.getCustomerById(customerId);

        if (!customer) return;

        this.openModal('customer-coupons-modal');

        // Mostra info cliente
        document.getElementById('coupon-customer-name').textContent = `${customer.firstName} ${customer.lastName}`;
        document.getElementById('coupon-customer-phone').textContent = customer.phone || '';

        // Mostra coupon
        this.displayCustomerCoupons(customer);
    },

    displayCustomerCoupons(customer) {
        const container = document.getElementById('customer-coupons-list');
        const noMessage = document.getElementById('no-coupons-message');

        if (!container) return;

        const coupons = (customer.coupons || []).filter(c => !c.used);

        if (coupons.length === 0) {
            container.innerHTML = '';
            if (noMessage) noMessage.style.display = 'block';
            return;
        }

        if (noMessage) noMessage.style.display = 'none';

        container.innerHTML = coupons.map(coupon => {
            const isExpired = coupon.expiryDate && new Date(coupon.expiryDate) < new Date();

            return `
        <div class="border-2 ${isExpired ? 'border-gray-300 bg-gray-50' : 'border-blue-200 bg-blue-50'} rounded-lg p-4">
            <div class="flex justify-between items-start mb-2">
                <div class="flex-1">
                    <h4 class="font-bold text-lg ${isExpired ? 'text-gray-500' : 'text-blue-700'}">${coupon.campaignName || 'Coupon'}</h4>
                    <p class="text-sm text-gray-600">${coupon.description || ''}</p>
                    ${isExpired ? '<p class="text-xs text-red-600 font-bold mt-1">⚠️ SCADUTO</p>' : ''}
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-2 text-sm mb-3">
                <div>
                    <p class="text-gray-500">Codice:</p>
                    <p class="font-mono font-bold text-blue-600">${coupon.code}</p>
                </div>
                <div>
                    <p class="text-gray-500">Scadenza:</p>
                    <p class="font-bold">${Utils.formatDate(coupon.expiryDate)}</p>
                </div>
            </div>
            
            ${!isExpired ? `
            <button onclick="app.sendCouponWhatsApp('${customer.id}', '${coupon.id}')" 
                    class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-bold">
                💬 Invia su WhatsApp
            </button>
            ` : ''}
        </div>
        `;
        }).join('');
    },

    sendCouponWhatsApp(customerId, couponId) {
        const customer = CustomersModule.getCustomerById(customerId);
        if (!customer) return;

        const coupon = customer.coupons.find(c => c.id === couponId);
        if (!coupon) {
            Utils.showToast('Coupon non trovato', 'error');
            return;
        }

        WhatsAppModule.sendCouponMessage(customer, coupon);
    },

    quickAddStamps(qty) {
        FidelityModule.addStamps(this.currentFidelityCustomer, qty);
        this.openFidelityDetail(this.currentFidelityCustomer);
        this.loadFidelity();
    },

    showFidelityCard() {
        if (!this.currentFidelityCustomer) return; // ← Corretto

        const fidelity = FidelityModule.getFidelityCustomer(this.currentFidelityCustomer);
        const customer = CustomersModule.getCustomerById(this.currentFidelityCustomer);

        if (!fidelity || !customer) return;

        this.displayFidelityCard(customer, fidelity);
    },

    resendFidelityCard() {
        if (!this.currentFidelityCustomer) return; // ← Corretto

        const customer = CustomersModule.getCustomerById(this.currentFidelityCustomer);

        if (!customer) {
            Utils.showToast("❌ Cliente non trovato", "error");
            return;
        }

        if (!customer.phone) {
            Utils.showToast("❌ Cliente senza numero di telefono", "error");
            return;
        }

        const confirm = window.confirm(
            `Inviare tessera fidelity a:\n\n` +
            `${customer.firstName} ${customer.lastName}\n` +
            `📞 ${customer.phone}\n\n` +
            `Continuare?`
        );

        if (!confirm) return;

        // Invia tramite WhatsApp
        WhatsAppModule.sendWelcomeMessage(customer, true);

        Utils.showToast("✅ Messaggio WhatsApp aperto!", "success");
    },

    displayFidelityCard(customer, fidelity) {
        const availableRewards = Math.floor(fidelity.stamps / CONFIG.FIDELITY.STAMPS_FOR_REWARD);
        const currentStamps = fidelity.stamps % CONFIG.FIDELITY.STAMPS_FOR_REWARD;

        const cardHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onclick="this.remove()">
            <div class="bg-gradient-to-br from-purple-500 to-pink-500 text-white p-8 rounded-3xl shadow-2xl max-w-md" onclick="event.stopPropagation()">
                <div class="text-center mb-6">
                    <h2 class="text-3xl font-bold">🎁 Tessera Fidelity</h2>
                    <p class="text-lg mt-2">${customer.firstName} ${customer.lastName}</p>
                </div>
                
                <div class="bg-white/20 backdrop-blur rounded-2xl p-6 mb-6">
                    <div class="text-center mb-4">
                        <p class="text-sm opacity-90">Bollini Attuali</p>
                        <p class="text-6xl font-bold">${currentStamps}</p>
                        <p class="text-sm opacity-75">su ${CONFIG.FIDELITY.STAMPS_FOR_REWARD}</p>
                    </div>
                    
                    <div class="flex justify-center gap-2 mb-4 flex-wrap">
                        ${Array.from({ length: CONFIG.FIDELITY.STAMPS_FOR_REWARD }, (_, i) =>
            `<div class="w-8 h-8 rounded-full ${i < currentStamps ? 'bg-yellow-400' : 'bg-white/30'}"></div>`
        ).join('')}
                    </div>
                </div>
                
                <div class="bg-white/20 backdrop-blur rounded-2xl p-4 mb-6">
                    <p class="text-center">
                        <span class="text-4xl font-bold">${availableRewards}</span>
                        <span class="text-lg"> Premi Disponibili</span>
                    </p>
                </div>
                
                <div class="text-center text-sm opacity-75">
                    <p>Totale bollini raccolti: ${fidelity.totalStamps || 0}</p>
                    <p class="mt-1">Membro dal ${Utils.formatDate(fidelity.joinedAt)}</p>
                </div>
                
                <button onclick="this.closest('.fixed').remove()" 
                        class="w-full mt-6 bg-white text-purple-600 py-3 rounded-xl font-bold hover:bg-gray-100">
                    ✕ Chiudi
                </button>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', cardHTML);
    },

    openCustomStamps() {
        document.getElementById('custom-stamps-input').value = '';
        this.openModal('custom-stamps-modal');
    },

    saveCustomStamps() {
        const qty = parseInt(document.getElementById('custom-stamps-input').value);
        if (!qty || qty < 1) {
            Utils.showToast("Inserisci un numero valido", "error");
            return;
        }

        const updatedFidelity = FidelityModule.addStamps(this.currentFidelityCustomer, qty);

        // ← AGGIUNGI QUI IL CODICE WHATSAPP
        const customer = CustomersModule.getCustomerById(this.currentFidelityCustomer);
        if (customer && customer.phone) {
            const phone = WhatsAppModule.formatPhone(customer.phone);
            const message = `Ciao ${customer.firstName}! ⭐

    Hai ricevuto ${qty} bollini!

    Totale bollini: ${updatedFidelity.stamps}
    Prossimo premio tra: ${10 - updatedFidelity.stamps} bollini

    Continua così! 🎉`;

            WhatsAppModule.openWhatsApp(phone, message);
        }

        this.closeModal('custom-stamps-modal');
        this.openFidelityDetail(this.currentFidelityCustomer);
        this.loadFidelity();
    },

    showHistory() {
        const history = document.getElementById('fidelity-detail-history');
        history.classList.toggle('hidden');

        if (!history.classList.contains('hidden')) {
            const fidelity = FidelityModule.getFidelityCustomer(this.currentFidelityCustomer);
            const historyHtml = fidelity.history.map(h => `
            <div class="border-b py-2">
                <p class="text-sm font-medium">${h.type === 'earned' ? '+ ' + h.stamps + ' bollini' : h.type}</p>
                <p class="text-xs text-gray-500">${Utils.formatDateTime(h.date)}</p>
            </div>
        `).join('');
            document.getElementById('fidelity-history-list').innerHTML = historyHtml || '<p class="text-sm text-gray-500">Nessuna cronologia</p>';
        }
    },

    showAllFidelityCustomers() {
        if (confirm("ATTENZIONE: Vuoi davvero azzerare tutti i dati fidelity?")) {
            FidelityModule.fidelityCustomers = [];
            FidelityModule.saveFidelity();
            this.loadFidelity();
        }
    },

    deleteFidelityCustomer(customerId) {
        if (confirm("Eliminare questo cliente dal programma fidelity?")) {
            const idx = FidelityModule.fidelityCustomers.findIndex(f => f.customerId === customerId);
            if (idx > -1) {
                FidelityModule.fidelityCustomers.splice(idx, 1);
                FidelityModule.saveFidelity();
                this.loadFidelity();
            }
        }
    },

    loadCoupons() {
        const campaigns = CouponsModule.getAllCampaigns();
        this.displayCampaigns(campaigns);
    },

    displayCampaigns(campaigns) {
        const container = document.getElementById('campaigns-list');
        if (!container) return;

        if (campaigns.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 py-8">Nessuna campagna attiva</p>';
            return;
        }

        container.innerHTML = campaigns.map(c => {
            if (!c || !c.id) return '';
            const eligible = this.getEligibleCustomers(c); const assigned = eligible.filter(cust => {
                const customer = CustomersModule.getCustomerById(cust.customerId);
                return customer?.coupons?.some(cp => cp.campaignId === c.id);
            }).length;

            return `
            <div class="bg-white rounded-lg shadow-lg overflow-hidden">
                <div class="bg-gradient-to-r from-pink-500 to-purple-500 text-white p-4">
                    <h3 class="text-xl font-bold">${c.name}</h3>
                    <p class="text-sm">${c.description}</p>
                </div>
                
                <div class="p-4">
                    <div class="grid grid-cols-2 gap-3 mb-3">
                        <div class="bg-gray-50 p-3 rounded">
                            <p class="text-xs text-gray-600">Clienti idonei</p>
                            <p class="text-2xl font-bold">${eligible.length}</p>
                        </div>
                        <div class="bg-green-50 p-3 rounded">
                            <p class="text-xs text-gray-600">Coupon assegnati</p>
                            <p class="text-2xl font-bold text-green-600">${assigned}</p>
                        </div>
                    </div>
                    
                    <p class="text-sm text-gray-600 mb-2">📅 ${this.formatCampaignDates(c)}</p>
                    <p class="text-sm text-gray-600 mb-3">⏰ Scade: ${Utils.formatDate(c.expiryDate)}</p>
                    
                    <div class="flex gap-2">
                        <button onclick="app.assignCoupons('${c.id}')" class="flex-1 bg-pink-600 text-white px-4 py-2 rounded hover:bg-pink-700">
                            Assegna Coupon
                        </button>
                        <button onclick="app.viewCampaignDetails('${c.id}')" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                            Dettagli
                        </button>
                        <button onclick="app.deleteCampaign('${c.id}')" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `;
        }).join('');
    },

    getEligibleCustomers(campaign) {
        if (!campaign || !campaign.dateType) {
            console.warn('Campagna senza dateType:', campaign);
            return [];
        }

        let orders = [];

        if (campaign.dateType === 'single' || campaign.dateType === 'multiple') {
            orders = OrdersModule.getAllOrders('recent').filter(o =>
                campaign.dates && campaign.dates.includes(o.deliveryDate)
            );
        } else if (campaign.dateType === 'range') {
            orders = OrdersModule.getAllOrders('recent').filter(o =>
                o.deliveryDate >= campaign.dateFrom && o.deliveryDate <= campaign.dateTo
            );
        }

        const customerIds = [...new Set(orders.map(o => o.customerId))];
        return customerIds.map(id => ({ customerId: id }));
    },

    openNewCampaignModal() {
        document.getElementById('campaign-name').value = '';
        document.getElementById('campaign-description').value = '';
        document.getElementById('campaign-date-from').value = '';
        document.getElementById('campaign-date-to').value = '';
        document.getElementById('campaign-expiry').value = '';
        this.openModal('new-campaign-modal');
    },

    toggleCampaignDateInputs() {
        const type = document.getElementById('campaign-date-type').value;

        document.getElementById('date-single-input').classList.add('hidden');
        document.getElementById('date-multiple-input').classList.add('hidden');
        document.getElementById('date-range-input').classList.add('hidden');

        if (type === 'single') {
            document.getElementById('date-single-input').classList.remove('hidden');
        } else if (type === 'multiple') {
            document.getElementById('date-multiple-input').classList.remove('hidden');
        } else if (type === 'range') {
            document.getElementById('date-range-input').classList.remove('hidden');
        }
    },

    saveCampaign() {
        const name = document.getElementById('campaign-name').value;
        const description = document.getElementById('campaign-description').value;
        const dateType = document.getElementById('campaign-date-type').value;
        const expiryDate = document.getElementById('campaign-expiry').value;

        if (!name || !description || !expiryDate) {
            Utils.showToast("Compila tutti i campi obbligatori", "error");
            return;
        }

        let campaignData = {
            name,
            description,
            dateType,
            expiryDate
        };

        // Gestisci date in base al tipo
        if (dateType === 'single') {
            const date = document.getElementById('campaign-date-single').value;
            if (!date) {
                Utils.showToast("Seleziona una data", "error");
                return;
            }
            campaignData.dates = [date];
        } else if (dateType === 'multiple') {
            const datesStr = document.getElementById('campaign-dates-multiple').value;
            if (!datesStr) {
                Utils.showToast("Inserisci almeno una data", "error");
                return;
            }
            campaignData.dates = datesStr.split(',').map(d => d.trim()).filter(d => d);
        } else if (dateType === 'range') {
            const dateFrom = document.getElementById('campaign-date-from').value;
            const dateTo = document.getElementById('campaign-date-to').value;
            if (!dateFrom || !dateTo) {
                Utils.showToast("Seleziona entrambe le date", "error");
                return;
            }
            campaignData.dateFrom = dateFrom;
            campaignData.dateTo = dateTo;
        }

        CouponsModule.createCampaign(campaignData);
        this.closeModal('new-campaign-modal');
        this.loadCoupons();
    },

    assignCoupons(campaignId) {
        const campaign = CouponsModule.getCampaignById(campaignId);
        if (!campaign) return;

        const eligible = this.getEligibleCustomers(campaign);

        if (eligible.length === 0) {
            Utils.showToast("Nessun cliente idoneo", "info");
            return;
        }

        if (confirm(`Assegnare coupon a ${eligible.length} clienti?`)) {
            let assigned = 0;
            eligible.forEach(e => {
                const customer = CustomersModule.getCustomerById(e.customerId);
                if (!customer) return;

                // Controlla se ha già questo coupon
                if (customer.coupons?.some(c => c.campaignId === campaignId)) return;

                CouponsModule.assignCoupon(e.customerId, campaignId);
                assigned++;
            });

            Utils.showToast(`✅ ${assigned} coupon assegnati!`, "success");
            this.loadCoupons();
        }
    },

    viewCampaignDetails(campaignId) {
        const campaign = CouponsModule.getCampaignById(campaignId);
        if (!campaign) {
            Utils.showToast("Campagna non trovata", "error");
            return;
        }

        const eligible = this.getEligibleCustomers(campaign);

        const html = `
        <div class="space-y-3">
            <h3 class="font-bold text-lg">${campaign.name}</h3>
            <p class="text-sm text-gray-600">${campaign.description}</p>
            
            <div class="bg-gray-50 p-3 rounded">
                <h4 class="font-bold mb-2">Clienti idonei (${eligible.length})</h4>
                ${eligible.map(e => {
            const customer = CustomersModule.getCustomerById(e.customerId);
            const hasCoupon = customer?.coupons?.some(c => c.campaignId === campaignId);
            return `
                        <div class="flex justify-between items-center py-1 border-b">
                            <span class="text-sm">${customer?.firstName} ${customer?.lastName}</span>
                            ${hasCoupon ? '<span class="text-green-600 text-xs">✓ Assegnato</span>' : '<span class="text-gray-400 text-xs">Non assegnato</span>'}
                        </div>
                    `;
        }).join('')}
            </div>
        </div>
    `;

        const div = document.createElement('div');
        div.innerHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="this.remove()">
            <div class="bg-white rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-y-auto" onclick="event.stopPropagation()">
                ${html}
                <button onclick="this.parentElement.parentElement.remove()" class="w-full mt-4 bg-gray-200 px-4 py-2 rounded">Chiudi</button>
            </div>
        </div>
    `;
        document.body.appendChild(div);
    },

    deleteCampaign(campaignId) {
        if (confirm("Eliminare questa campagna? I coupon già assegnati rimarranno validi.")) {
            CouponsModule.deleteCampaign(campaignId);
            this.loadCoupons();
        }
    },

    formatCampaignDates(campaign) {
        if (campaign.dateType === 'single') {
            return `Ritiro: ${Utils.formatDate(campaign.dates[0])}`;
        } else if (campaign.dateType === 'multiple') {
            return `Ritiri: ${campaign.dates.map(d => Utils.formatDate(d)).join(', ')}`;
        } else {
            return `Ritiri dal ${Utils.formatDate(campaign.dateFrom)} al ${Utils.formatDate(campaign.dateTo)}`;
        }
    },

    showAvailableRewards(customerId) {
        const rewards = FidelityModule.getAvailableRewards(customerId);
        if (rewards.length === 0) {
            Utils.showToast("Nessun premio disponibile", "info");
            return;
        }

        const customer = CustomersModule.getCustomerById(customerId);
        const html = `
        <div class="space-y-2">
            <h3 class="font-bold">Premi disponibili per ${customer.firstName} ${customer.lastName}</h3>
            ${rewards.map(r => `
                <div class="flex justify-between items-center bg-green-50 p-3 rounded">
                    <span>${r.description}</span>
                    <button onclick="app.redeemRewardConfirm('${customerId}', '${r.id}')" class="bg-green-600 text-white px-3 py-1 rounded">Riscuoti</button>
                </div>
            `).join('')}
        </div>
    `;

        // Mostra in un alert temporaneo (o puoi fare un modal dedicato)
        const div = document.createElement('div');
        div.innerHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="this.remove()">
            <div class="bg-white rounded-lg p-6 max-w-md" onclick="event.stopPropagation()">
                ${html}
                <button onclick="this.parentElement.parentElement.remove()" class="w-full mt-4 bg-gray-200 px-4 py-2 rounded">Chiudi</button>
            </div>
        </div>
    `;
        document.body.appendChild(div);
    },

    redeemRewardConfirm(customerId, rewardId) {
        if (confirm("Confermi il riscatto del premio?")) {
            FidelityModule.redeemReward(customerId, rewardId);
            document.querySelector('.fixed.inset-0').remove();
            this.loadFidelity();
            Utils.showToast("✅ Premio riscattato!", "success");
        }
    },

    generateFidelityCard(customerId) {
        QRModule.generateFidelityQR(customerId, (blob) => {
            if (!blob) {
                Utils.showToast("Errore generazione tessera", "error");
                return;
            }

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tessera-fidelity-${customerId}.png`;
            a.click();
            URL.revokeObjectURL(url);

            Utils.showToast("✅ Tessera scaricata!", "success");
        });
    },

    loadPreparation() {
        const date = document.getElementById('prep-date').value;
        if (!date) {
            Utils.showToast("Seleziona una data", "warning");
            return;
        }

        const orders = OrdersModule.getOrdersByDeliveryDate(date).filter(o =>
            o.status !== 'delivered' && o.status !== 'cancelled'
        );

        if (orders.length === 0) {
            document.getElementById('preparation-list').innerHTML =
                '<p class="text-center text-gray-500 py-8">📦 Nessun ordine da preparare per questa data</p>';
            return;
        }

        const byProduct = {};
        orders.forEach(order => {
            order.items.forEach(item => {
                const product = ProductsModule.getProductById(item.productId);
                if (!product) return;

                if (!byProduct[item.productId]) {
                    byProduct[item.productId] = {
                        productId: item.productId,
                        productName: product.name,
                        totalQty: 0,
                        orders: []
                    };
                }

                byProduct[item.productId].totalQty += item.quantity;
                byProduct[item.productId].orders.push({
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    customerId: order.customerId,
                    customerName: CustomersModule.getFullName(order.customerId),
                    quantity: item.quantity
                });
            });
        });

        this.displayPreparation(Object.values(byProduct));
    },

    displayPreparation(products) {
        const container = document.getElementById('preparation-list');
        const today = new Date().toISOString().split('T')[0];

        // Filtra prodotti con ordini preparabili (data non passata)
        const preparableProducts = products.filter(p => {
            return p.orders.some(o => {
                const order = OrdersModule.getOrderById(o.orderId);
                return order && order.deliveryDate >= today;
            });
        }).map(p => {
            // Filtra solo ordini con data non passata
            return {
                ...p,
                orders: p.orders.filter(o => {
                    const order = OrdersModule.getOrderById(o.orderId);
                    return order && order.deliveryDate >= today;
                })
            };
        });

        if (preparableProducts.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 py-8">Nessun ordine da preparare per questa data</p>';
            return;
        }

        container.innerHTML = products.map((p, idx) => {
            const date = document.getElementById('prep-date').value;
            const allPrepared = p.orders.every(o => {
                const order = OrdersModule.getOrderById(o.orderId);
                const item = order.items.find(i => i.productId === p.productId);
                return item?.prepared;
            });

            return `
            <div class="bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-300 rounded-lg overflow-hidden ${allPrepared ? 'opacity-50' : ''}">
                <div class="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 flex justify-between items-center cursor-pointer" onclick="document.getElementById('prep-${idx}').classList.toggle('hidden')">
                    <div>
                        <h3 class="text-xl font-bold">🍝 ${p.productName}</h3>
                        <p class="text-sm">${p.orders.length} ordini - Totale: ${p.totalQty.toFixed(2)}</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-sm">${p.orders.filter(o => {
                const order = OrdersModule.getOrderById(o.orderId);
                const item = order.items.find(i => i.productId === p.productId);
                return item?.prepared;
            }).length}/${p.orders.length} preparati</span>
                        <span class="text-2xl">▼</span>
                    </div>
                </div>
                
                <div id="prep-${idx}" class="p-4 hidden">
                    <button onclick="app.markAllProduct('${p.productId}')" class="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 mb-3 font-bold">
                        ✓ Segna tutti
                    </button>
                    
                    <table class="w-full text-sm">
                        <thead class="bg-gray-100">
                            <tr>
                                <th class="px-3 py-2 text-left">Ordine</th>
                                <th class="px-3 py-2 text-left">Cliente</th>
                                <th class="px-3 py-2 text-right">Quantità</th>
                                <th class="px-3 py-2 text-center">Stato</th>
                                <th class="px-3 py-2 text-center">Azione</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${p.orders.map(o => {
                const order = OrdersModule.getOrderById(o.orderId);
                const itemIdx = order.items.findIndex(i => i.productId === p.productId);
                const item = order.items[itemIdx];
                const isPrepared = item?.prepared;

                return `
                                    <tr class="border-b ${isPrepared ? 'bg-green-50' : ''}">
                                        <td class="px-3 py-2"><span class="bg-blue-600 text-white px-2 py-1 rounded text-xs">${o.orderNumber}</span></td>
                                        <td class="px-3 py-2">${o.customerName}</td>
                                        <td class="px-3 py-2 text-right font-bold">${o.quantity.toFixed(2)}</td>
                                        <td class="px-3 py-2 text-center">${isPrepared ? '<span class="text-green-600 font-bold">✓</span>' : '-'}</td>
                                        <td class="px-3 py-2 text-center">
                                            ${!isPrepared ? `
                                                <button onclick="app.markItemPrepared('${o.orderId}', ${itemIdx})" class="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700">Fatto</button>
                                            ` : '<span class="text-green-600 text-xs">Completato</span>'}
                                        </td>
                                    </tr>
                                `;
            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        }).join('');
    },

    markItemPrepared(orderId, itemIndex) {
        const order = OrdersModule.getOrderById(orderId);
        if (!order) return;

        // Blocca se data passata
        const today = new Date().toISOString().split('T')[0];
        if (order.deliveryDate && order.deliveryDate < today) {
            Utils.showToast("⛔ Non puoi preparare ordini con data passata", "error");
            return;
        }

        OrdersModule.markItemPrepared(orderId, itemIndex);
        this.loadPreparation();
    },

    markAllProduct(productId) {
        const date = document.getElementById('prep-date').value;

        // Blocca se data passata
        const today = new Date().toISOString().split('T')[0];
        if (date && date < today) {
            Utils.showToast("⛔ Non puoi preparare ordini con data passata", "error");
            return;
        }

        const marked = OrdersModule.markAllItemsOfProductPrepared(productId, date);
        Utils.showToast(`✅ ${marked} item preparati`, "success");
        this.loadPreparation();
    },

    applyPrepFilters() {
        const monthFilter = document.getElementById('prep-month-filter').value;
        const yearFilter = document.getElementById('prep-year-filter').value;

        if (monthFilter) {
            document.getElementById('prep-date').value = '';
            // Carica tutti ordini del mese
            const orders = OrdersModule.getAllOrders('recent').filter(o =>
                o.deliveryDate && o.deliveryDate.startsWith(monthFilter) &&
                o.status !== 'delivered' && o.status !== 'cancelled'
            );
            this.displayPreparationMultiDate(orders);
        } else if (yearFilter) {
            document.getElementById('prep-date').value = '';
            const orders = OrdersModule.getAllOrders('recent').filter(o =>
                o.deliveryDate && o.deliveryDate.startsWith(yearFilter) &&
                o.status !== 'delivered' && o.status !== 'cancelled'
            );
            this.displayPreparationMultiDate(orders);
        }
    },

    clearPrepFilters() {
        document.getElementById('prep-date').value = '';
        document.getElementById('prep-month-filter').value = '';
        document.getElementById('prep-year-filter').value = '';
        document.getElementById('prep-date').value = this.getTomorrowDate();
        this.loadPreparation();
    },

    displayPreparationMultiDate(orders) {
        // Raggruppa per prodotto (come loadPreparation)
        const byProduct = {};
        orders.forEach(order => {
            order.items.forEach(item => {
                const product = ProductsModule.getProductById(item.productId);
                if (!product) return;

                if (!byProduct[item.productId]) {
                    byProduct[item.productId] = {
                        productId: item.productId,
                        productName: product.name,
                        totalQty: 0,
                        orders: []
                    };
                }

                byProduct[item.productId].totalQty += item.quantity;
                byProduct[item.productId].orders.push({
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    customerId: order.customerId,
                    customerName: CustomersModule.getFullName(order.customerId),
                    quantity: item.quantity
                });
            });
        });

        this.displayPreparation(Object.values(byProduct));
    },

    applyModFilters() {
        const monthFilter = document.getElementById('mod-month-filter').value;
        const yearFilter = document.getElementById('mod-year-filter').value;

        let orders = OrdersModule.orders.filter(o => o.modifications);

        if (monthFilter) {
            document.getElementById('mod-date-filter').value = '';
            orders = orders.filter(o => o.deliveryDate && o.deliveryDate.startsWith(monthFilter));
        } else if (yearFilter) {
            document.getElementById('mod-date-filter').value = '';
            orders = orders.filter(o => o.deliveryDate && o.deliveryDate.startsWith(yearFilter));
        }

        this.displayModifications(orders);
    },

    clearModFilters() {
        document.getElementById('mod-date-filter').value = '';
        document.getElementById('mod-month-filter').value = '';
        document.getElementById('mod-year-filter').value = '';
        document.getElementById('mod-date-filter').value = this.getTomorrowDate();
        this.loadModifications();
    },

    loadModifications() {
        const date = document.getElementById('mod-date-filter').value;
        const orders = OrdersModule.getOrdersWithModifications(date || null);
        this.displayModifications(orders);
    },

    displayModifications(orders) {
        const container = document.getElementById('modifications-list');
        if (!container) return;

        if (orders.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 py-8">Nessuna modifica da effettuare</p>';
            return;
        }

        container.innerHTML = orders.map(o => {
            const customer = CustomersModule.getCustomerById(o.customerId);
            const customerName = customer ? `${customer.firstName} ${customer.lastName}` : 'N/A';

            const toAddCount = o.modifications.toAdd.filter(m => !m.completed).length;
            const toRemoveCount = o.modifications.toRemove.filter(m => !m.completed).length;

            return `
            <div class="bg-white rounded-lg shadow-lg overflow-hidden">
                <div class="bg-orange-500 text-white p-4 flex justify-between items-center">
                    <div>
                        <h3 class="font-bold text-lg">Ordine #${o.orderNumber || o.id.slice(-6)}</h3>
                        <p class="text-sm">${customerName}</p>
                    </div>
                    <span class="bg-white text-orange-600 px-3 py-1 rounded-full font-bold">${toAddCount + toRemoveCount} modifiche</span>
                </div>
                
                <div class="p-4">
                    ${o.modifications.toAdd.length > 0 ? `
                        <div class="mb-4">
                            <div class="bg-orange-100 border-l-4 border-orange-500 p-3 mb-2">
                                <h4 class="font-bold text-orange-700">➕ DA AGGIUNGERE</h4>
                            </div>
                            ${o.modifications.toAdd.map((item, idx) => {
                const product = ProductsModule.getProductById(item.productId);
                return `
                                    <div class="flex justify-between items-center p-2 border-b ${item.completed ? 'opacity-50 line-through' : ''}">
                                        <span>${product?.name || 'N/A'} - ${item.quantity} kg</span>
                                        ${!item.completed ? `
                                            <button onclick="app.completeModification('${o.id}', 'add', ${idx})" class="bg-orange-600 text-white px-3 py-1 rounded text-sm">✓ Aggiunto</button>
                                        ` : '<span class="text-green-600">✓</span>'}
                                    </div>
                                `;
            }).join('')}
                        </div>
                    ` : ''}
                    
                    ${o.modifications.toRemove.length > 0 ? `
                        <div>
                            <div class="bg-red-100 border-l-4 border-red-500 p-3 mb-2">
                                <h4 class="font-bold text-red-700">➖ DA RIMUOVERE</h4>
                            </div>
                            ${o.modifications.toRemove.map((item, idx) => {
                const product = ProductsModule.getProductById(item.productId);
                return `
                                    <div class="flex justify-between items-center p-2 border-b ${item.completed ? 'opacity-50 line-through' : ''}">
                                        <span>${product?.name || 'N/A'} - ${item.quantity} kg</span>
                                        ${!item.completed ? `
                                            <button onclick="app.completeModification('${o.id}', 'remove', ${idx})" class="bg-red-600 text-white px-3 py-1 rounded text-sm">✓ Rimosso</button>
                                        ` : '<span class="text-green-600">✓</span>'}
                                    </div>
                                `;
            }).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        }).join('');
    },

    completeModification(orderId, type, index) {
        const order = OrdersModule.getOrderById(orderId);

        // Marca item come preparato quando completi modifica
        if (type === 'add' && order.modifications) {
            const modItem = order.modifications.toAdd[index];
            const orderItem = order.items.find(i => i.productId === modItem.productId);
            if (orderItem) {
                orderItem.prepared = true;
            }
        }

        OrdersModule.markModificationComplete(orderId, type, index);
        this.loadModifications();
        this.loadOrders();
    },

    displayOrders(orders) {
        const container = document.getElementById('orders-list');
        if (!container) return;

        if (orders.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">Nessun ordine</p>';
            return;
        }

        const statusColors = {
            pending: "bg-yellow-100 text-yellow-800",
            confirmed: "bg-blue-100 text-blue-800",
            in_preparation: "bg-purple-100 text-purple-800",
            ready: "bg-green-100 text-green-800",
            delivered: "bg-gray-100 text-gray-800",
            cancelled: "bg-red-100 text-red-800"
        };

        const statusNames = {
            pending: "In attesa",
            confirmed: "Confermato",
            in_preparation: "In preparazione",
            ready: "Pronto",
            delivered: "Consegnato",
            cancelled: "Annullato"
        };

        container.innerHTML = orders.map(o => {
            const customer = CustomersModule.getCustomerById(o.customerId);
            const customerName = customer ? `${customer.firstName} ${customer.lastName}` : 'Cliente sconosciuto';

            return `
            <div class="bg-white p-4 rounded-lg shadow cursor-pointer" onclick="app.viewOrderDetails('${o.id}')">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h3 class="font-bold text-lg">
                            #${o.orderNumber || 'N/A'} - ${customerName}
                            ${o.modifications ? '<span class="ml-2 bg-orange-500 text-white px-2 py-1 rounded-full text-xs">⚠️ Da modificare</span>' : ''}
                            ${o.deliveryDate && o.deliveryDate < new Date().toISOString().split('T')[0] && o.status !== 'delivered' ? '<span class="ml-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs">📅 Data passata</span>' : ''}
                            ${o.deposit > 0 ? (o.depositPaid ? '<span class="ml-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs">✓ Acconto</span>' : '<span class="ml-2 bg-yellow-500 text-white px-2 py-1 rounded-full text-xs">⚠️ Acconto richiesto</span>') : ''}
                        </h3>
                        <p class="text-sm text-gray-600">${o.items.length} prodotti</p>
                        ${o.deliveryDate ? `<p class="text-sm text-gray-600">📅 Consegna: ${Utils.formatDate(o.deliveryDate)} ${o.deliveryTime || ''}</p>` : ''}
                        ${o.deposit > 0 ? `<p class="text-sm font-medium ${o.depositPaid ? 'text-green-600' : 'text-orange-600'}">💰 Acconto: ${Utils.formatPrice(o.deposit)} ${o.depositPaid ? '(Ricevuto)' : '(Da ricevere)'}</p>` : ''}
                        <p class="text-xs text-gray-500">Creato: ${Utils.formatDateTime(o.createdAt)}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-2xl font-bold text-blue-600">${Utils.formatPrice(o.totalAmount)}</p>
                        ${o.deposit > 0 && !o.depositPaid ? `<p class="text-sm text-orange-600 font-medium">Residuo: ${Utils.formatPrice(o.totalAmount - o.deposit)}</p>` : ''}
                        <span class="text-xs px-2 py-1 rounded ${statusColors[o.status]}">${statusNames[o.status]}</span>
                    </div>
                </div>
            
            <div class="flex gap-2 mt-3">
                ${o.status === 'pending' ? `<button onclick="OrdersModule.changeOrderStatus('${o.id}', 'in_preparation'); app.loadOrders()" class="text-xs px-3 py-1 bg-blue-600 text-white rounded">Conferma</button>` : ''}
                ${o.status === 'ready' ? `<button onclick="OrdersModule.changeOrderStatus('${o.id}', 'delivered'); app.loadOrders()" class="text-xs px-3 py-1 bg-gray-600 text-white rounded">Consegnato</button>` : ''}
                ${o.status === 'delivered' ? `<button onclick="app.undoDelivery('${o.id}')" class="text-xs px-3 py-1 bg-orange-600 text-white rounded">↩️ Annulla consegna</button>` : ''}
                ${o.status !== 'delivered' ? `<button onclick="app.editOrder('${o.id}')" class="text-xs px-3 py-1 bg-gray-200 rounded">✏️ Modifica</button>` : ''}
                <button onclick="app.deleteOrder('${o.id}')" class="text-red-600 text-sm ml-auto">🗑️</button>
            </div>
        </div>
    `;
        }).join('');
    },

    filterOrders(status) {
        this.currentOrderFilter = status;
        if (status === 'all') {
            this.applyOrderFilters();
        } else {
            let orders = OrdersModule.getAllOrders('recent').filter(o => o.status === status);

            // Applica anche filtri data se attivi
            const dateFilter = document.getElementById('order-date-filter').value;
            const monthFilter = document.getElementById('order-month-filter').value;
            const yearFilter = document.getElementById('order-year-filter').value;

            if (dateFilter) {
                orders = orders.filter(o => o.deliveryDate === dateFilter);
            } else if (monthFilter) {
                orders = orders.filter(o => o.deliveryDate && o.deliveryDate.startsWith(monthFilter));
            } else if (yearFilter) {
                orders = orders.filter(o => o.deliveryDate && o.deliveryDate.startsWith(yearFilter));
            }

            this.displayOrders(orders);
        }
    },

    applyOrderFilters() {
        const dateFilter = document.getElementById('order-date-filter').value;
        const monthFilter = document.getElementById('order-month-filter').value;
        const yearFilter = document.getElementById('order-year-filter').value;

        let orders = OrdersModule.getAllOrders('recent');

        // Filtra per data specifica
        if (dateFilter) {
            orders = orders.filter(o => o.deliveryDate === dateFilter);
        }
        // Filtra per mese (formato YYYY-MM)
        else if (monthFilter) {
            orders = orders.filter(o => o.deliveryDate && o.deliveryDate.startsWith(monthFilter));
        }
        // Filtra per anno
        else if (yearFilter) {
            orders = orders.filter(o => o.deliveryDate && o.deliveryDate.startsWith(yearFilter));
        }

        // Applica anche filtro stato se attivo
        if (this.currentOrderFilter && this.currentOrderFilter !== 'all') {
            orders = orders.filter(o => o.status === this.currentOrderFilter);
        }

        this.displayOrders(orders);
    },

    clearOrderFilters() {
        document.getElementById('order-date-filter').value = '';
        document.getElementById('order-month-filter').value = '';
        document.getElementById('order-year-filter').value = '';
        this.currentOrderFilter = null;
        this.loadOrders();
    },

    showAllOrders() {
        // Rimuovi tutti i filtri
        document.getElementById('order-date-filter').value = '';
        document.getElementById('order-month-filter').value = '';
        document.getElementById('order-year-filter').value = '';
        this.currentOrderFilter = null;

        // Mostra tutti gli ordini
        this.displayOrders(OrdersModule.getAllOrders('recent'));

        Utils.showToast("📋 Tutti gli ordini visualizzati", "info");
    },

    populateYearFilter() {
        const select = document.getElementById('order-year-filter');
        const orders = OrdersModule.getAllOrders('recent');

        const years = [...new Set(orders.map(o => o.deliveryDate?.substring(0, 4)).filter(y => y))].sort().reverse();

        select.innerHTML = '<option value="">Tutti gli anni</option>' +
            years.map(y => `<option value="${y}">${y}</option>`).join('');
    },

    openNewOrderModal() {
        console.log("📦 Apertura modal nuovo ordine...");

        this.editingOrderId = null;
        this.openModal('new-order-modal');

        // Popola lista clienti ricercabile
        this.populateCustomersList();

        // Reset campi cliente e consegna
        document.getElementById('order-customer-search').value = '';
        document.getElementById('order-customer').value = '';
        document.getElementById('order-customer-list').classList.add('hidden');
        document.getElementById('order-delivery-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('order-delivery-time').value = '';
        document.getElementById('order-notes').value = '';
        document.getElementById('order-deposit').value = '';
        document.getElementById('order-deposit-paid').checked = false;

        // Reset carrello
        this.orderItems = [];
        this.editingCartIndex = null;

        // Popola dropdown prodotti
        this.populateProductsDropdown();

        // Reset form prodotti
        document.getElementById('cart-product-select').value = '';
        document.getElementById('cart-quantity').value = '1';
        document.getElementById('cart-price').value = '0';

        // Mostra carrello vuoto
        this.displayCartItems();

        // Reset totale
        this.updateOrderTotal();

        const modalTitle = document.querySelector('#new-order-modal h3');
        if (modalTitle) {
            modalTitle.textContent = '📦 Nuovo Ordine';
        }
    },

    orderItems: [],

    populateCustomersList() {
        console.log("📋 INIZIO populateCustomersList"); // ← DEBUG

        const allCustomers = CustomersModule.getAllCustomers('name');
        console.log("📊 Tutti i clienti:", allCustomers.length); // ← DEBUG

        const customers = allCustomers.filter(c => c.type !== 'fornitore');
        console.log("📊 Clienti (no fornitori):", customers.length); // ← DEBUG

        const listContainer = document.getElementById('order-customer-list');
        console.log("📦 Container trovato:", !!listContainer); // ← DEBUG

        if (!listContainer) {
            console.error("❌ order-customer-list non trovato!");
            return;
        }

        listContainer.innerHTML = customers.map(c => {
            const fullName = `${c.firstName} ${c.lastName}`;
            return `
            <div class="customer-item p-3 hover:bg-blue-50 cursor-pointer border-b"
                 data-id="${c.id}"
                 data-name="${fullName}">
                <div class="font-bold">${fullName}</div>
                ${c.phone ? `<div class="text-sm text-gray-600">📞 ${c.phone}</div>` : ''}
            </div>
        `;
        }).join('');

        console.log("✅ HTML generato, lunghezza:", listContainer.innerHTML.length); // ← DEBUG

        // Aggiungi event listener
        const items = document.querySelectorAll('.customer-item');
        console.log("👥 Customer items trovati:", items.length); // ← DEBUG

        items.forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                const name = item.dataset.name;
                console.log("🖱️ Click su cliente:", name); // ← DEBUG
                app.selectCustomer(id, name);
            });
        });

        console.log("✅ FINE populateCustomersList"); // ← DEBUG
    },

    filterCustomerDropdown() {
        const searchInput = document.getElementById('order-customer-search');
        const listContainer = document.getElementById('order-customer-list');
        const query = searchInput.value.toLowerCase();

        console.log("🔍 Ricerca:", query); // ← DEBUG

        // ← MOSTRA SEMPRE IL DROPDOWN
        listContainer.classList.remove('hidden');

        const items = document.querySelectorAll('.customer-item');
        let visibleCount = 0;

        items.forEach(item => {
            const name = item.dataset.name.toLowerCase();
            if (!query || name.includes(query)) {
                item.style.display = 'block';
                visibleCount++;
            } else {
                item.style.display = 'none';
            }
        });

        console.log("👀 Clienti visibili:", visibleCount); // ← DEBUG
    },

    selectCustomer(customerId, customerName) {
        console.log("✅ Cliente selezionato:", customerId, customerName); // ← DEBUG

        document.getElementById('order-customer').value = customerId;
        document.getElementById('order-customer-search').value = customerName;
        document.getElementById('order-customer-list').classList.add('hidden');
    },

    showCustomerDropdown() {
        const listContainer = document.getElementById('order-customer-list');
        if (listContainer) {
            listContainer.classList.remove('hidden');
        }
    },

    filterProducts(itemId) {
        const itemDiv = document.getElementById(itemId);
        const searchInput = itemDiv.querySelector(`.product-search-${itemId}`);
        const categoryFilter = itemDiv.querySelector(`.product-category-filter-${itemId}`);
        const select = itemDiv.querySelector('.order-item-product');

        const searchQuery = searchInput.value.toLowerCase();
        const selectedCategory = categoryFilter.value;

        Array.from(select.options).forEach(option => {
            if (option.value === '') {
                option.style.display = 'block';
                return;
            }

            const name = option.dataset.name || '';
            const category = option.dataset.category || '';

            const matchesSearch = !searchQuery || name.includes(searchQuery);
            const matchesCategory = !selectedCategory || category === selectedCategory;

            if (matchesSearch && matchesCategory) {
                option.style.display = 'block';
            } else {
                option.style.display = 'none';
            }
        });
    },

    // Popola dropdown prodotti nel form
    populateProductsDropdown() {
        const select = document.getElementById('cart-product-select');
        if (!select) return;

        const products = ProductsModule.getAllProducts().filter(p => p.active);

        select.innerHTML = '<option value="">-- Seleziona prodotto --</option>' +
            products.map(p => {
                const modeIcon = p.mode === 'weight' ? '🍝' : p.mode === 'kg' ? '⚖️' : '🔢';
                return `<option value="${p.id}" 
                            data-price="${p.price}" 
                            data-unit="${p.unit}"
                            data-weight="${p.averageWeight || 0}"
                            data-mode="${p.mode || 'pieces'}">
                        ${modeIcon} ${p.name} - ${Utils.formatPrice(p.price)}/${p.unit}
                    </option>`;
            }).join('');

        // Auto-aggiorna prezzo quando cambia prodotto
        select.onchange = () => {
            const option = select.options[select.selectedIndex];
            const priceInput = document.getElementById('cart-price');
            if (option && option.dataset.price) {
                priceInput.value = option.dataset.price;
            }
        };

        // Salva tutte le opzioni per il filtro
        this.allProductOptions = Array.from(select.options);
    },

    // Filtra prodotti nel dropdown
    filterCartProducts() {
        const searchInput = document.getElementById('cart-product-search');
        const select = document.getElementById('cart-product-select');

        if (!searchInput || !select || !this.allProductOptions) return;

        const query = searchInput.value.toLowerCase();

        // Rimuovi tutte le opzioni
        select.innerHTML = '';

        // Filtra e ri-aggiungi
        this.allProductOptions.forEach(option => {
            if (option.value === '' || option.textContent.toLowerCase().includes(query)) {
                select.appendChild(option.cloneNode(true));
            }
        });

        // Auto-seleziona se c'è solo 1 risultato (oltre al placeholder)
        if (select.options.length === 2 && query.length > 2) {
            select.selectedIndex = 1;
            select.onchange(); // Trigger prezzo
        }
    },

    // Aggiungi prodotto al carrello
    addProductToCart() {
        const select = document.getElementById('cart-product-select');
        const quantity = parseFloat(document.getElementById('cart-quantity').value);
        const price = parseFloat(document.getElementById('cart-price').value);

        if (!select.value) {
            Utils.showToast("Seleziona un prodotto", "error");
            return;
        }

        if (!quantity || quantity <= 0) {
            Utils.showToast("Inserisci una quantità valida", "error");
            return;
        }

        const option = select.options[select.selectedIndex];
        const productId = select.value;
        const weight = parseFloat(option.dataset.weight) || 0;
        const mode = option.dataset.mode || 'pieces';

        let finalQuantity = quantity;
        let unit = 'pz';

        switch (mode) {
            case 'weight':
                if (weight > 0) {
                    finalQuantity = weight * quantity;
                    unit = 'kg';
                }
                break;
            case 'pieces':
                finalQuantity = quantity;
                unit = 'pz';
                break;
            case 'kg':
                finalQuantity = quantity;
                unit = 'kg';
                break;
        }

        const cartItem = {
            productId: productId,
            quantity: finalQuantity,
            unit: unit,
            mode: mode,
            price: price,
            prepared: false
        };

        if (this.editingCartIndex !== null) {
            // Modifica esistente
            this.orderItems[this.editingCartIndex] = cartItem;
            this.editingCartIndex = null;
        } else {
            // Nuovo
            this.orderItems.push(cartItem);
        }

        // Reset form
        document.getElementById('cart-product-select').value = '';
        document.getElementById('cart-product-search').value = '';
        document.getElementById('cart-quantity').value = '1';
        document.getElementById('cart-price').value = '0';

        // Aggiorna visualizzazione
        this.displayCartItems();
        this.updateOrderTotal();
    },

    // Mostra prodotti nel carrello
    displayCartItems() {
        const container = document.getElementById('cart-items-list');
        const emptyMsg = document.getElementById('cart-empty-message');

        if (!container) return;

        if (this.orderItems.length === 0) {
            container.innerHTML = '';
            if (emptyMsg) emptyMsg.classList.remove('hidden');
            return;
        }

        if (emptyMsg) emptyMsg.classList.add('hidden');

        container.innerHTML = this.orderItems.map((item, index) => {
            const product = ProductsModule.getProductById(item.productId);
            if (!product) return '';

            const displayQty = item.mode === 'weight' ?
                `${(item.quantity / (product.averageWeight || 1)).toFixed(0)} pz (${item.quantity.toFixed(2)} kg)` :
                `${item.quantity.toFixed(2)} ${item.unit}`;

            return `
            <div class="bg-white border-2 border-gray-200 rounded-lg p-3 flex items-center justify-between">
                <div class="flex-1">
                    <p class="font-bold text-gray-800">${product.name}</p>
                    <p class="text-sm text-gray-600">${displayQty} × ${Utils.formatPrice(item.price)} = ${Utils.formatPrice(item.quantity * item.price)}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="app.editCartItem(${index})" 
                            class="bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600">
                        ✏️
                    </button>
                    <button onclick="app.removeCartItem(${index})" 
                            class="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600">
                        🗑️
                    </button>
                </div>
            </div>
        `;
        }).join('');
    },

    // Modifica prodotto nel carrello
    editCartItem(index) {
        const item = this.orderItems[index];
        if (!item) return;

        const product = ProductsModule.getProductById(item.productId);
        if (!product) return;

        // Calcola quantità originale
        let displayQty = item.quantity;
        if (item.mode === 'weight' && product.averageWeight > 0) {
            displayQty = item.quantity / product.averageWeight;
        }

        // Popola form
        document.getElementById('cart-product-select').value = item.productId;
        document.getElementById('cart-quantity').value = displayQty;
        document.getElementById('cart-price').value = item.price;

        this.editingCartIndex = index;

        Utils.showToast("Modifica il prodotto e clicca 'Aggiungi Prodotto'", "info");
    },

    // Rimuovi prodotto dal carrello
    removeCartItem(index) {
        this.orderItems.splice(index, 1);
        this.displayCartItems();
        this.updateOrderTotal();
    },

    updateOrderTotal() {
        let total = 0;

        this.orderItems.forEach(item => {
            total += item.quantity * item.price;
        });

        const totalElement = document.getElementById('order-total');
        if (totalElement) {
            totalElement.textContent = Utils.formatPrice(total);
        }
    },

    saveOrder() {
        const customerId = document.getElementById('order-customer').value;

        if (!customerId) {
            Utils.showToast("❌ Seleziona un cliente", "error");
            return;
        }

        const items = [...this.orderItems]; // Usa il carrello

        if (items.length === 0) {
            Utils.showToast("❌ Aggiungi almeno un prodotto", "error");
            return;
        }

        const orderData = {
            customerId: customerId,
            items: items,
            deliveryDate: document.getElementById('order-delivery-date').value,
            deliveryTime: document.getElementById('order-delivery-time').value,
            notes: document.getElementById('order-notes').value,
            deposit: parseFloat(document.getElementById('order-deposit').value) || 0,
            depositPaid: document.getElementById('order-deposit-paid').checked
        };

        try {
            if (this.editingOrderId) {
                OrdersModule.updateOrder(this.editingOrderId, orderData);
                Utils.showToast("✅ Ordine modificato!", "success");
                this.editingOrderId = null;
            } else {
                const newOrder = OrdersModule.createOrder(orderData);

                if (newOrder && confirm("💬 Mandare conferma ordine su WhatsApp?")) {
                    WhatsAppModule.sendOrderConfirmation(newOrder);
                }
            }

            this.closeModal('new-order-modal');
            this.loadOrders();

        } catch (error) {
            console.error("❌ Errore salvataggio ordine:", error);
            Utils.showToast("❌ Errore: " + error.message, "error");
        }

        this.updateCustomerStats(customerId);
        this.loadDashboard();
    },

    updateCustomerStats(customerId) {
        const customer = CustomersModule.getCustomerById(customerId);
        if (!customer) return;

        // Conta ordini e spesa totale
        const customerOrders = OrdersModule.getAllOrders('all').filter(o => o.customerId === customerId);

        customer.totalOrders = customerOrders.length;
        customer.totalSpent = customerOrders.reduce((sum, order) => {
            return sum + (order.totalAmount || 0);
        }, 0);

        CustomersModule.saveCustomers();
    },

    compareOrders(oldItems, newItems) {
        const toAdd = [];
        const toRemove = [];

        // Trova prodotti aggiunti
        newItems.forEach(newItem => {
            const oldItem = oldItems.find(oi => oi.productId === newItem.productId);
            if (!oldItem) {
                toAdd.push(newItem);
            } else if (newItem.quantity > oldItem.quantity) {
                toAdd.push({
                    ...newItem,
                    quantity: newItem.quantity - oldItem.quantity
                });
            }
        });

        // Trova prodotti rimossi
        oldItems.forEach(oldItem => {
            const newItem = newItems.find(ni => ni.productId === oldItem.productId);
            if (!newItem) {
                toRemove.push(oldItem);
            } else if (newItem.quantity < oldItem.quantity) {
                toRemove.push({
                    ...oldItem,
                    quantity: oldItem.quantity - newItem.quantity
                });
            }
        });

        return { toAdd, toRemove };
    },


    editOrder(orderId) {
        const order = OrdersModule.getOrderById(orderId);
        if (!order) return;

        // Blocca modifica ordini consegnati
        if (order.status === 'delivered') {
            Utils.showToast("⛔ Ordine già consegnato, non modificabile", "error");
            return;
        }

        this.editingOrderId = orderId;
        this.openModal('new-order-modal');

        // Popola ricerca clienti
        this.populateCustomersList();

        // Imposta cliente selezionato
        const customer = CustomersModule.getCustomerById(order.customerId);
        if (customer) {
            document.getElementById('order-customer-search').value = `${customer.firstName} ${customer.lastName}`;
            document.getElementById('order-customer').value = order.customerId;
            document.getElementById('order-customer-list').classList.add('hidden');
        }

        // Imposta dati ordine
        document.getElementById('order-delivery-date').value = order.deliveryDate;
        document.getElementById('order-delivery-time').value = order.deliveryTime || '';
        document.getElementById('order-notes').value = order.notes || '';
        document.getElementById('order-deposit').value = order.deposit || '';
        document.getElementById('order-deposit-paid').checked = order.depositPaid || false;

        // Popola carrello con prodotti esistenti
        this.orderItems = order.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unit: item.unit,
            mode: item.mode,
            price: item.price,
            prepared: item.prepared || false
        }));

        // Mostra prodotti nel carrello
        this.displayCartItems();
        this.updateOrderTotal();

        // Cambia titolo modal
        const modalTitle = document.querySelector('#new-order-modal h3');
        if (modalTitle) {
            modalTitle.textContent = '✏️ Modifica Ordine';
        }
    },

    deleteOrder(orderId) {
        // PRIMA prendi l'ordine per sapere il cliente
        const order = OrdersModule.getOrderById(orderId);

        if (OrdersModule.deleteOrder(orderId)) {
            this.loadOrders();
            this.loadDashboard(); // Aggiorna dashboard

            // Aggiorna stats cliente
            if (order && order.customerId) {
                this.updateCustomerStats(order.customerId);
            }
        }
    },

    async deleteAllOrders() {
        const confirm1 = confirm("⚠️ ATTENZIONE!\n\nVuoi eliminare TUTTI gli ordini?\n\nQuesta azione è IRREVERSIBILE!");
        if (!confirm1) return;

        const confirm2 = confirm("Sei ASSOLUTAMENTE sicuro?\n\nDigita OK per confermare");
        if (!confirm2) return;

        const confirm3 = prompt("Scrivi DELETE in maiuscolo per confermare:");
        if (confirm3 !== "DELETE") {
            Utils.showToast("❌ Cancellazione annullata", "error");
            return;
        }

        OrdersModule.orders = [];
        await OrdersModule.saveOrders();

        this.loadOrders();
        Utils.showToast("✅ Tutti gli ordini eliminati", "success");
    },

    undoDelivery(orderId) {
        if (confirm("⚠️ Annullare la consegna e riportare l'ordine a 'Pronto'?")) {
            OrdersModule.changeOrderStatus(orderId, 'ready');

            // Rimuovi bollini fidelity se erano stati aggiunti
            const order = OrdersModule.getOrderById(orderId);
            if (order && FidelityModule) {
                const stampsToRemove = Math.floor(order.totalAmount / 10);
                if (stampsToRemove > 0) {
                    const fidelity = FidelityModule.getFidelityCustomer(order.customerId);
                    if (fidelity) {
                        fidelity.stamps = Math.max(0, fidelity.stamps - stampsToRemove);
                        fidelity.totalStamps = Math.max(0, fidelity.totalStamps - stampsToRemove);
                        FidelityModule.saveFidelity();
                    }
                }
            }

            this.loadOrders();
            Utils.showToast("↩️ Consegna annullata", "success");
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
        const customers = CustomersModule.getAllCustomers('name');
        this.displayCustomers(customers);
        this.updateCustomersStats(); // ← AGGIUNGI
    },

    updateCustomersStats() {
        const customers = CustomersModule.getAllCustomers();
        const withOrders = customers.filter(c => c.totalOrders > 0).length;
        const fidelity = FidelityModule.fidelityCustomers.length;
        const totalRevenue = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);

        this.updateElement('customers-stat-total', customers.length);
        this.updateElement('customers-stat-with-orders', withOrders);
        this.updateElement('customers-stat-fidelity', fidelity);
        this.updateElement('customers-stat-revenue', Utils.formatPrice(totalRevenue));
    },

    searchCustomers() {
        const query = document.getElementById('customer-search').value.toLowerCase();
        const customers = CustomersModule.getAllCustomers('name');

        if (!query) {
            this.displayCustomers(customers);
            return;
        }

        const filtered = customers.filter(c =>
            c.firstName.toLowerCase().includes(query) ||
            c.lastName.toLowerCase().includes(query) ||
            (c.phone && c.phone.includes(query)) ||
            (c.email && c.email.toLowerCase().includes(query))
        );

        this.displayCustomers(filtered);
    },

    filterCustomers(type) {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active', 'bg-blue-600', 'text-white');
            btn.classList.add('bg-gray-200');
        });

        const activeBtn = document.querySelector(`[data-filter="${type}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active', 'bg-blue-600', 'text-white');
            activeBtn.classList.remove('bg-gray-200');
        }

        let customers = CustomersModule.getAllCustomers('name');

        switch (type) {
            case 'top':
                customers = customers
                    .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
                    .slice(0, 10);
                break;
            case 'with-orders':
                customers = customers.filter(c => c.totalOrders > 0);
                break;
            case 'fidelity':
                const fidelityIds = FidelityModule.fidelityCustomers.map(fc => fc.customerId);
                customers = customers.filter(c => fidelityIds.includes(c.id));
                break;
            case 'recent':
                const monthAgo = new Date();
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                customers = customers.filter(c => new Date(c.createdAt) > monthAgo);
                break;
        }

        this.displayCustomers(customers);
    },

    displayCustomers(customers) {
        const container = document.getElementById('customers-list');
        if (!container) return;

        if (customers.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8 col-span-full">Nessun cliente</p>';
            return;
        }

        container.innerHTML = customers.map(c => {
            const fidelityCustomer = FidelityModule.fidelityCustomers.find(fc => fc.customerId === c.id);
            const hasAvailableRewards = fidelityCustomer ? FidelityModule.getAvailableRewards(c.id).length > 0 : false;
            const stamps = fidelityCustomer ? fidelityCustomer.stamps : 0;
            const totalStamps = fidelityCustomer ? fidelityCustomer.totalStamps : 0;
            const isTop = totalStamps >= 20; // Top se ha completato almeno 2 tessere (20 bollini)
            const availableCoupons = (c.coupons || []).filter(coup => !coup.used && !coup.expired).length;

            return `
                <div class="bg-white p-5 rounded-xl shadow-lg hover:shadow-xl transition border-2 border-gray-100">
                    
                    <!-- Header con Nome e Badge -->
                    <div class="flex justify-between items-start mb-3">
                        <h3 class="font-bold text-lg cursor-pointer" onclick="app.viewCustomerDetails('${c.id}')">${c.firstName} ${c.lastName}</h3>
                        <div class="flex gap-1">
                            ${c.inWhatsAppGroup ? '<span class="bg-green-500 text-white text-xs px-2 py-1 rounded-full">💬</span>' : ''}
                            ${hasAvailableRewards ? '<span class="bg-purple-500 text-white text-xs px-2 py-1 rounded-full">🎁</span>' : ''}
                            ${availableCoupons > 0 ? '<span class="bg-orange-500 text-white text-xs px-2 py-1 rounded-full">🎫</span>' : ''}
                            ${isTop ? '<span class="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">👑</span>' : ''}
                        </div>
                    </div>
                    
                    <!-- Info Contatto -->
                    <div class="text-sm text-gray-600 space-y-1 mb-3 cursor-pointer" onclick="app.viewCustomerDetails('${c.id}')">
                        ${c.phone ? `<p>📞 ${c.phone}</p>` : ''}
                        ${c.email ? `<p class="text-xs">📧 ${c.email}</p>` : ''}
                    </div>
                    
                    <!-- Statistiche CON BOLLINI -->
                    <div class="grid grid-cols-3 gap-2 pt-3 border-t border-gray-200 mb-3 cursor-pointer" onclick="app.viewCustomerDetails('${c.id}')">
                        <div class="text-center bg-blue-50 rounded-lg p-2">
                            <p class="text-xs text-gray-600">Ordini</p>
                            <p class="text-xl font-bold text-blue-600">${c.totalOrders || 0}</p>
                        </div>
                        <div class="text-center bg-green-50 rounded-lg p-2">
                            <p class="text-xs text-gray-600">Speso</p>
                            <p class="text-lg font-bold text-green-600">${Utils.formatPrice(c.totalSpent || 0)}</p>
                        </div>
                        <div class="text-center bg-purple-50 rounded-lg p-2">
                            <p class="text-xs text-gray-600">Bollini</p>
                            <p class="text-xl font-bold text-purple-600">${stamps} ⭐</p>
                        </div>
                    </div>
                    
                    <!-- Data Registrazione e Bottone Elimina -->
                    <div class="flex justify-between items-center">
                        <p class="text-xs text-gray-400">📅 ${Utils.formatDate(c.createdAt)}</p>
                        <button onclick="event.stopPropagation(); app.deleteCustomer('${c.id}')" 
                                class="bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 text-sm font-bold">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    openNewCustomerModal() {
        this.editingCustomerId = null; // Reset per nuova creazione
        this.openModal('new-customer-modal');

        // Reset campi
        document.getElementById('customer-firstname').value = '';
        document.getElementById('customer-lastname').value = '';
        document.getElementById('customer-phone').value = '';
        document.getElementById('customer-email').value = '';
        document.getElementById('customer-address').value = '';

        // Reset titolo
        const modalTitle = document.querySelector('#new-customer-modal h3');
        if (modalTitle) {
            modalTitle.textContent = 'Nuovo Cliente';
        }
    },

    viewCustomerDetails(customerId) {
        const customer = CustomersModule.getCustomerById(customerId);
        if (!customer) return;

        // Apri modal e riempi con dati esistenti
        this.openModal('new-customer-modal');

        document.getElementById('customer-firstname').value = customer.firstName || '';
        document.getElementById('customer-lastname').value = customer.lastName || '';
        document.getElementById('customer-phone').value = customer.phone || '';
        document.getElementById('customer-email').value = customer.email || '';
        document.getElementById('customer-address').value = customer.address || '';

        // Cambia titolo modal
        const modalTitle = document.querySelector('#new-customer-modal h3');
        if (modalTitle) {
            modalTitle.textContent = `Modifica: ${customer.firstName} ${customer.lastName}`;
        }

        // Salva ID per update
        this.editingCustomerId = customerId;
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

        // MODIFICA o CREA
        if (this.editingCustomerId) {
            // MODIFICA esistente
            CustomersModule.updateCustomer(this.editingCustomerId, data);
            this.editingCustomerId = null;
            this.closeModal('new-customer-modal');
            this.loadCustomers();
            this.loadDashboard();
            Utils.showToast("✅ Cliente modificato!", "success");
        } else {
            // CREA nuovo
            const newCustomer = CustomersModule.addCustomer(data);
            this.closeModal('new-customer-modal');
            this.loadCustomers();
            this.loadDashboard();

            // Chiedi se mandare messaggio benvenuto
            if (confirm("Mandare messaggio di benvenuto su WhatsApp con tessera fidelity?")) {
                WhatsAppModule.sendWelcomeMessage(newCustomer, true);
            }
        }
    },

    deleteCustomer(customerId) {
        // Controlla se ha ordini attivi
        const hasOrders = OrdersModule.getAllOrders('recent').some(o =>
            o.customerId === customerId && o.status !== 'delivered' && o.status !== 'cancelled'
        );

        if (hasOrders) {
            Utils.showToast("⛔ Impossibile eliminare: cliente ha ordini attivi", "error");
            return;
        }

        if (confirm("Eliminare questo cliente? Questa azione è irreversibile.")) {
            if (CustomersModule.deleteCustomer(customerId)) {
                this.loadCustomers();
                this.loadDashboard();
            }
        }
    },

    loadProducts() {
        console.log("🍝 Caricamento prodotti...");
        this.displayProductsByCategory();
        this.updateProductsStats();
        this.populateCategoryFilters();
    },

    updateProductsStats() {
        const products = ProductsModule.getAllProducts();
        const active = products.filter(p => p.active).length;
        const categories = new Set(products.map(p => p.category)).size;
        const avgPrice = products.length > 0
            ? products.reduce((sum, p) => sum + p.price, 0) / products.length
            : 0;

        this.updateElement('products-stat-total', products.length);
        this.updateElement('products-stat-active', active);
        this.updateElement('products-stat-categories', categories);
        this.updateElement('products-stat-avg-price', Utils.formatPrice(avgPrice));
    },

    searchProducts() {
        const query = document.getElementById('product-search').value.toLowerCase();

        if (!query) {
            this.displayProductsByCategory();
            return;
        }

        const products = ProductsModule.getAllProducts().filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.category.toLowerCase().includes(query) ||
            (p.description && p.description.toLowerCase().includes(query))
        );

        const container = document.getElementById('products-by-category');
        if (products.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">Nessun prodotto trovato</p>';
            return;
        }

        container.innerHTML = `
        <div class="mb-6">
            <h3 class="text-xl font-bold mb-4">🔍 Risultati ricerca (${products.length})</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${products.map(p => this.renderProductCard(p)).join('')}
            </div>
        </div>
    `;
    },

    populateCategoryFilters() {
        const products = ProductsModule.getAllProducts();
        const categories = [...new Set(products.map(p => p.category))].sort();

        const container = document.getElementById('category-filters');
        if (!container) return;

        container.innerHTML = `
        <button onclick="app.filterProductsByCategory('all')" 
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm category-filter active"
                data-category="all">
            📋 Tutte (${products.length})
        </button>
        ${categories.map(cat => {
            const count = products.filter(p => p.category === cat).length;
            return `
                <button onclick="app.filterProductsByCategory('${cat}')" 
                        class="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 font-medium text-sm category-filter"
                        data-category="${cat}">
                    ${cat} (${count})
                </button>
            `;
        }).join('')}
    `;
    },

    displayProductsByCategory() {
        const products = ProductsModule.getAllProducts();
        const categories = [...new Set(products.map(p => p.category))].sort();

        const container = document.getElementById('products-by-category');
        if (!container) return;

        if (products.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">Nessun prodotto</p>';
            return;
        }

        container.innerHTML = categories.map(category => {
            const categoryProducts = products.filter(p => p.category === category);

            return `
            <div class="mb-8">
                <h3 class="text-2xl font-bold mb-4 text-blue-600">${category}</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${categoryProducts.map(p => this.renderProductCard(p)).join('')}
                </div>
            </div>
        `;
        }).join('');
    },

    renderProductCard(product) {
        const categoryIcons = {
            'Pasta': '🍝',
            'Gastronomia': '🍲',
            'Prodotti Forno': '🥖',
            'Sughi': '🍅',
            'Prodotti Rivendita': '📦'
        };

        const icon = categoryIcons[product.category] || '📁';
        const weightText = product.averageWeight ? `${product.averageWeight} kg` : '';

        return `
                <div class="bg-white rounded-xl shadow-lg hover:shadow-xl transition border-2 ${product.active ? 'border-green-200' : 'border-gray-200'}">
                    <div class="bg-gradient-to-br from-orange-50 to-red-50 p-6 rounded-t-xl">
                        <div class="flex justify-between items-start mb-2">
                            <span class="text-5xl">${icon}</span>
                            ${!product.active ? '<span class="bg-gray-500 text-white text-xs px-2 py-1 rounded-full">Non attivo</span>' : ''}
                        </div>
                        <h4 class="font-bold text-xl mt-2">${product.name}</h4>
                    </div>
                    
                    <div class="p-5">
                        <div class="mb-4">
                            <p class="text-3xl font-bold text-blue-600">${Utils.formatPrice(product.price)}/${product.unit}</p>
                            ${weightText ? `<p class="text-sm text-gray-600">Peso medio: ${weightText}</p>` : ''}
                        </div>
                        
                        ${product.description ? `<p class="text-sm text-gray-600 mb-4">${product.description}</p>` : ''}
                        
                        <div class="flex gap-2">
                            <button onclick="app.toggleProductActive('${product.id}')" 
                                    class="flex-1 ${product.active ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600'} text-white px-3 py-2 rounded-lg text-sm font-bold">
                                ${product.active ? '❌ Disattiva' : '✅ Attiva'}
                            </button>
                            <button onclick="app.editProduct('${product.id}')" 
                                    class="bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 text-sm font-bold">
                                ✏️
                            </button>
                            <button onclick="app.deleteProduct('${product.id}')" 
                                    class="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 text-sm font-bold">
                                🗑️
                            </button>
                        </div>
                    </div>
                </div>
            `;
    },

    filterProductsByCategory(category) {
        document.querySelectorAll('.category-filter').forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('bg-gray-200');
        });

        const activeBtn = document.querySelector(`[data-category="${category}"]`);
        if (activeBtn) {
            activeBtn.classList.add('bg-blue-600', 'text-white');
            activeBtn.classList.remove('bg-gray-200');
        }

        if (category === 'all') {
            this.displayProductsByCategory();
            return;
        }

        const products = ProductsModule.getAllProducts().filter(p => p.category === category);

        const container = document.getElementById('products-by-category');
        container.innerHTML = `
        <div class="mb-6">
            <h3 class="text-2xl font-bold mb-4 text-blue-600">${category}</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${products.map(p => this.renderProductCard(p)).join('')}
            </div>
        </div>
    `;
    },

    toggleProductActive(productId) {
        ProductsModule.toggleProductActive(productId);
        this.loadProducts();
    },

    openNewProductModal() {
        this.editingProductId = null; // ← RESET ID
        console.log("🆕 Nuovo prodotto"); // ← DEBUG

        this.openModal('new-product-modal');

        // Reset campi
        document.getElementById('product-name').value = '';
        document.getElementById('product-category').value = '';
        document.getElementById('product-category-custom').classList.add('hidden');
        document.getElementById('product-price').value = '';
        document.getElementById('product-unit').value = 'kg';
        document.getElementById('product-weight').value = '';
        document.getElementById('product-mode').value = '';
        document.getElementById('product-description').value = '';
        document.getElementById('product-ingredients').value = '';
        document.getElementById('product-custom-allergens').value = '';

        document.querySelectorAll('.allergen-checkbox').forEach(cb => cb.checked = false);

        this.loadCustomCategories();

        const modalTitle = document.querySelector('#new-product-modal h3');
        if (modalTitle) {
            modalTitle.textContent = '🍝 Nuovo Prodotto';
        }
    },

    handleCategoryChange() {
        const select = document.getElementById('product-category');
        const customInput = document.getElementById('product-category-custom');

        if (select.value === '__custom__') {
            customInput.classList.remove('hidden');
            customInput.focus();
            customInput.required = true;
        } else {
            customInput.classList.add('hidden');
            customInput.required = false;
            customInput.value = '';
        }
    },

    saveCustomCategory(category) {
        let customCategories = JSON.parse(localStorage.getItem('customProductCategories') || '[]');

        if (!customCategories.includes(category)) {
            customCategories.push(category);
            localStorage.setItem('customProductCategories', JSON.stringify(customCategories));
            Utils.showToast(`✅ Categoria "${category}" salvata!`, "success");
        }
    },

    loadCustomCategories() {
        const customCategories = JSON.parse(localStorage.getItem('customProductCategories') || '[]');
        const select = document.getElementById('product-category');

        if (!select) return;

        // Mantieni solo opzioni base
        const baseHTML = `
        <option value="">-- Seleziona --</option>
        <option value="Pasta">🍝 Pasta</option>
        <option value="Gastronomia">🍲 Gastronomia</option>
        <option value="Prodotti Forno">🥖 Prodotti Forno</option>
        <option value="Sughi">🍅 Sughi</option>
        <option value="Prodotti Rivendita">📦 Prodotti Rivendita</option>
    `;

        // Aggiungi categorie custom
        const customHTML = customCategories.map(cat =>
            `<option value="${cat}">📁 ${cat}</option>`
        ).join('');

        const addNewHTML = `<option value="__custom__">➕ Aggiungi nuova categoria...</option>`;

        select.innerHTML = baseHTML + customHTML + addNewHTML;
    },


    saveProduct(event) {
        event.preventDefault();

        console.log("💾 Salvataggio prodotto, editingProductId:", this.editingProductId);

        const name = document.getElementById('product-name').value.trim();
        let category = document.getElementById('product-category').value;
        const customCategory = document.getElementById('product-category-custom').value.trim();

        // Se categoria custom, usa quella
        if (category === '__custom__' && customCategory) {
            category = customCategory;
            this.saveCustomCategory(category);
        }

        const price = document.getElementById('product-price').value;
        const unit = document.getElementById('product-unit').value;
        const weight = document.getElementById('product-weight').value;
        const mode = document.getElementById('product-mode').value;
        const description = document.getElementById('product-description').value.trim();
        const ingredients = document.getElementById('product-ingredients').value.trim();

        // Raccogli allergeni
        const allergens = Array.from(document.querySelectorAll('.allergen-checkbox:checked'))
            .map(cb => cb.value);

        const customAllergens = document.getElementById('product-custom-allergens').value
            .split(',')
            .map(a => a.trim())
            .filter(a => a);

        const allAllergens = [...allergens, ...customAllergens];

        // Validazione
        if (!name || !category || !price || !mode) {
            Utils.showToast("❌ Compilare i campi obbligatori", "error");
            return;
        }

        const data = {
            name,
            category,
            price,
            unit,
            averageWeight: weight || null,
            mode,
            description,
            ingredients,
            allergens: allAllergens
        };

        // MODIFICA o CREA usando this.editingProductId
        if (this.editingProductId) {
            console.log("✏️ MODIFICA prodotto:", this.editingProductId);
            ProductsModule.updateProduct(this.editingProductId, data);
            this.editingProductId = null; // Reset
            Utils.showToast("✅ Prodotto modificato!", "success");
        } else {
            console.log("🆕 NUOVO prodotto");
            ProductsModule.addProduct(data);
        }

        this.closeModal('new-product-modal');
        this.loadProducts();
    },

    editProduct(productId) {
        const product = ProductsModule.getProductById(productId);
        if (!product) return;

        this.openModal('new-product-modal');

        // Popola campi
        const fields = {
            'product-name': product.name || '',
            'product-category': product.category || '',
            'product-price': product.price || '',
            'product-unit': product.unit || 'kg',
            'product-weight': product.averageWeight || '',
            'product-mode': product.mode || 'pieces',
            'product-description': product.description || '',
            'product-ingredients': product.ingredients || '',
            'product-custom-allergens': ''
        };

        Object.keys(fields).forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = fields[fieldId];
            }
        });

        // Checkbox allergeni
        document.querySelectorAll('.allergen-checkbox').forEach(cb => {
            cb.checked = product.allergens && product.allergens.includes(cb.value);
        });

        // Allergeni custom
        if (product.allergens) {
            const standardAllergens = Array.from(document.querySelectorAll('.allergen-checkbox'))
                .map(cb => cb.value);
            const customAllergens = product.allergens.filter(a => !standardAllergens.includes(a));
            if (customAllergens.length > 0) {
                document.getElementById('product-custom-allergens').value = customAllergens.join(', ');
            }
        }

        // Cambia titolo modal
        const modalTitle = document.querySelector('#new-product-modal h3');
        if (modalTitle) {
            modalTitle.textContent = `Modifica: ${product.name}`;
        }

        // ← IMPORTANTE: SETTA L'ID 👇
        this.editingProductId = productId;
        console.log("✏️ Editing product:", productId); // ← DEBUG
    },

    deleteProduct(productId) {
        if (ProductsModule.deleteProduct(productId)) {
            this.loadProducts();
        }
    },

    loadFidelity() {
        console.log("🎁 Caricamento fidelity...");
        const fidelityList = FidelityModule.getAllFidelityCustomers();
        this.allFidelityCustomers = fidelityList; // ← AGGIUNGI QUESTA RIGA
        this.displayFidelityCustomers(fidelityList);
    },

    filterFidelityCustomers() {
        const searchTerm = document.getElementById('fidelity-search').value.toLowerCase();

        if (!searchTerm) {
            this.displayFidelityCustomers(this.allFidelityCustomers);
            return;
        }

        const filtered = this.allFidelityCustomers.filter(f => {
            const customer = CustomersModule.getCustomerById(f.customerId);
            if (!customer) return false;

            const fullName = `${customer.firstName} ${customer.lastName}`.toLowerCase();
            const phone = (customer.phone || '').replace(/\s/g, '');

            return fullName.includes(searchTerm) || phone.includes(searchTerm);
        });

        this.displayFidelityCustomers(filtered);
    },

    loadSettings() {
        console.log("⚙️ Caricamento impostazioni...");
        this.updateDropboxStatus();
    },

    updateDropboxStatus() {
        const statusDiv = document.getElementById('dropbox-status');
        const actionsDiv = document.getElementById('dropbox-actions');

        if (!statusDiv || !actionsDiv) return;

        if (Storage.dropboxClient) {
            statusDiv.innerHTML = '<p class="text-green-600 font-bold">✅ Connesso</p>';
            actionsDiv.innerHTML = `
            <button onclick="app.manualSync()" class="bg-blue-600 text-white px-4 py-2 rounded mr-2 hover:bg-blue-700">🔄 Sincronizza ora</button>
            <button onclick="app.disconnectDropbox()" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Disconnetti</button>
        `;
        } else {
            statusDiv.innerHTML = '<p class="text-gray-600">Non connesso</p>';
            actionsDiv.innerHTML = `
            <button onclick="app.connectDropbox()" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Connetti Dropbox</button>
        `;
        }
    },

    connectDropbox() {
        Storage.startDropboxAuth();
    },

    async manualSync() {
        if (!Storage.dropboxClient) {
            Utils.showToast("⚠️ Dropbox non connesso", "warning");
            return;
        }

        const choice = confirm("Vuoi:\n\nOK = Scaricare dati DA Dropbox\nAnnulla = Caricare dati SU Dropbox");

        if (choice) {
            // SCARICA da Dropbox
            Utils.showToast("📥 Caricamento da Dropbox...", "info");

            await CustomersModule.init();
            await ProductsModule.init();
            await OrdersModule.init();
            await FidelityModule.init();
            await CouponsModule.init();

            Utils.showToast("✅ Dati caricati da Dropbox!", "success");

            setTimeout(() => window.location.reload(), 1000);
        } else {
            // CARICA su Dropbox
            Utils.showToast("📤 Caricamento su Dropbox...", "info");
            await Storage.syncAllToDropbox(false);
            Utils.showToast("✅ Dati caricati su Dropbox!", "success");
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