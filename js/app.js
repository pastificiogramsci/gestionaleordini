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
        switch(tabName) {
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
        console.log("📦 Caricamento ordini...");
        // TODO: Implementare visualizzazione lista ordini
    },
    
    loadCustomers() {
        console.log("👥 Caricamento clienti...");
        // TODO: Implementare visualizzazione lista clienti
    },
    
    loadProducts() {
        console.log("🍝 Caricamento prodotti...");
        // TODO: Implementare visualizzazione lista prodotti
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
    
    // Crea nuovo ordine
    openNewOrderModal() {
        this.openModal('new-order-modal');
        // TODO: Popola form nuovo ordine
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