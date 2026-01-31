// =============================================
// Delivery Analytics Pro v2.0
// Main Application Entry Point
// =============================================

import dataService from './services/supabase.service.js';
import excelParser from './services/excel-parser.service.js';
import store from './modules/store.js';
import chartsManager from './modules/charts.manager.js';
import tablesManager from './modules/tables.manager.js';
import uiManager from './modules/ui.manager.js';
import * as helpers from './utils/helpers.js';
import { FILE_TYPES } from './utils/constants.js';

// =============================================
// Initialization
// =============================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚚 Delivery Analytics Pro v2.0 starting...');

    // Initialize UI manager
    uiManager.init();

    // Create settings modal
    createSettingsModal();

    // Check connection
    await checkConnection();

    // Load data
    await loadData();

    // Initialize event listeners
    initializeEventListeners();

    // Update version display
    updateVersion();

    // Set initial UI state
    updateDataTypeUI();

    console.log('✅ Application ready');
});

/**
 * Check connection to backend/database
 */
async function checkConnection() {
    uiManager.showLoading(true);

    try {
        const connectionType = await dataService.checkConnection();
        store.setConnection(connectionType, connectionType !== 'local');
        uiManager.updateConnectionStatus(connectionType);
    } catch (error) {
        console.error('Connection check failed:', error);
        store.setConnection('local', false);
        uiManager.updateConnectionStatus('local');
    }

    uiManager.showLoading(false);
}

/**
 * Update version badge
 */
function updateVersion() {
    const badge = document.getElementById('appVersion');
    if (badge) badge.textContent = 'v2.0.0';
}

// =============================================
// Settings Modal
// =============================================

function createSettingsModal() {
    // Check if modal already exists
    if (document.getElementById('settingsModal')) return;

    const modalHTML = `
        <div id="settingsModal" class="modal-overlay">
            <div class="modal">
                <div class="modal-header">
                    <h2><i class="fas fa-cog"></i> Database Settings</h2>
                    <button class="modal-close" onclick="closeSettings()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="supabaseUrl">Supabase URL</label>
                        <input type="text" id="supabaseUrl" placeholder="https://your-project.supabase.co">
                        <div class="form-hint">Find this in your Supabase project settings</div>
                    </div>
                    <div class="form-group">
                        <label for="supabaseKey">Supabase Anon Key</label>
                        <input type="password" id="supabaseKey" placeholder="eyJhbGciOiJIUzI1NiIs...">
                        <div class="form-hint">Use the anon/public key, not the service key</div>
                    </div>
                    <div class="form-group">
                        <label for="backendUrl">Backend API URL (optional)</label>
                        <input type="text" id="backendUrl" placeholder="http://localhost:8000">
                        <div class="form-hint">Leave empty to connect directly to Supabase</div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeSettings()">Cancel</button>
                    <button class="btn btn-primary" onclick="saveSettings()">
                        <i class="fas fa-save"></i> Save & Connect
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Load existing settings
    loadSettingsToForm();
}

function openSettings() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        loadSettingsToForm();
        modal.classList.add('show');
    }
}

function closeSettings() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

function loadSettingsToForm() {
    const settings = helpers.loadFromStorage('supabaseSettings') || {};

    const urlInput = document.getElementById('supabaseUrl');
    const keyInput = document.getElementById('supabaseKey');
    const backendInput = document.getElementById('backendUrl');

    if (urlInput) urlInput.value = settings.url || '';
    if (keyInput) keyInput.value = settings.key || '';
    if (backendInput) backendInput.value = settings.backendUrl || '';
}

async function saveSettings() {
    const url = document.getElementById('supabaseUrl')?.value.trim();
    const key = document.getElementById('supabaseKey')?.value.trim();
    const backendUrl = document.getElementById('backendUrl')?.value.trim();

    // Save to localStorage
    const settings = { url, key, backendUrl };
    helpers.saveToStorage('supabaseSettings', settings);

    // Update dataService with new credentials
    if (url && key) {
        dataService.url = url;
        dataService.key = key;
        dataService.headers = {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };
    }

    // Close modal
    closeSettings();

    // Re-check connection
    helpers.showToast('Testing connection...', 'info');
    await checkConnection();

    if (store.useSupabase) {
        helpers.showToast('Connected to database!', 'success');
        await loadData();
    } else {
        helpers.showToast('Could not connect. Check your credentials.', 'warning');
    }
}

// =============================================
// Data Loading
// =============================================

async function loadData() {
    uiManager.showLoading(true);

    try {
        if (store.isDeliveryMode()) {
            await loadDeliveryData();
        } else {
            await loadPickupData();
        }

        populateFilters();
        applyFilters();

    } catch (error) {
        console.error('Load error:', error);
        helpers.showToast('Error loading data', 'error');
    } finally {
        uiManager.showLoading(false);
    }
}

async function loadDeliveryData() {
    if (store.useSupabase) {
        const data = await dataService.getCourierPerformance();
        store.deliveryData.all = data;
        helpers.showToast(`Loaded ${data.length} delivery records`, 'success');
    } else {
        // Load from localStorage
        const stored = helpers.loadFromStorage('deliveryDataV4');
        if (stored && stored.length > 0) {
            store.deliveryData.all = stored.map(row => ({
                ...row,
                report_date: row._dateStr || row.report_date,
                courier_name: row["ПІБ кур'єра"] || row.courier_name,
                car_number: row['Номер авто'] || row.car_number,
                department: row['Підрозділ відомості'] || row.department,
                loaded_parcels: row._loaded || row.loaded_parcels || 0,
                delivered_parcels: row._delivered || row.delivered_parcels || 0
            }));
            helpers.showToast(`Loaded ${stored.length} records from local storage`, 'info');
        }
    }
}

async function loadPickupData() {
    if (store.useSupabase) {
        const data = await dataService.getPickupOrders();
        store.pickupData.all = data;
        helpers.showToast(`Loaded ${data.length} pickup orders`, 'success');
    } else {
        const stored = helpers.loadFromStorage('pickupDataV1');
        if (stored && stored.length > 0) {
            store.pickupData.all = stored;
            helpers.showToast(`Loaded ${stored.length} pickup orders from local storage`, 'info');
        }
    }
}

// =============================================
// File Upload (supports multiple files)
// =============================================

async function handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    uiManager.showLoading(true);

    let totalProcessed = 0;
    let totalErrors = 0;

    try {
        // Process each file
        for (const file of files) {
            try {
                const result = await processFile(file);
                totalProcessed += result.processed;
                totalErrors += result.errors;
            } catch (err) {
                console.error(`Error processing ${file.name}:`, err);
                totalErrors++;
            }
        }

        // Reload and update UI
        await loadData();

        // Show summary
        if (files.length > 1) {
            helpers.showToast(
                `Processed ${files.length} files: ${totalProcessed} records imported`,
                totalErrors > 0 ? 'warning' : 'success'
            );
        }

    } catch (error) {
        console.error('Upload error:', error);
        helpers.showToast('Error processing files: ' + error.message, 'error');
    } finally {
        uiManager.showLoading(false);
        event.target.value = '';
    }
}

async function processFile(file) {
    console.log(`📁 Processing: ${file.name}`);

    // Parse the file (auto-detects type)
    const result = await excelParser.parseFile(file);

    console.log(`📊 File type: ${result.fileType}, Records: ${result.stats.processed}`);

    // Show warnings/errors
    if (result.warnings.length > 0) {
        uiManager.showAlerts(result.warnings.slice(0, 5), 'warning');
    }
    if (result.errors.length > 0) {
        uiManager.showAlerts(result.errors.slice(0, 5), 'error');
    }

    if (result.records.length === 0) {
        helpers.showToast(`${file.name}: No valid records found`, 'error');
        return { processed: 0, errors: 1 };
    }

    // Switch to correct data type if needed
    if (result.fileType !== store.activeDataType) {
        store.setActiveDataType(result.fileType);
        updateDataTypeUI();
    }

    // Save data
    if (result.fileType === FILE_TYPES.DELIVERY) {
        await saveDeliveryData(result.records, result.filename);
    } else {
        await savePickupData(result.records, result.filename);
    }

    const typeLabel = result.fileType === FILE_TYPES.DELIVERY ? 'delivery' : 'pickup';
    helpers.showToast(
        `${file.name}: ${result.records.length} ${typeLabel} records imported`,
        result.errors.length > 0 ? 'warning' : 'success'
    );

    return { processed: result.records.length, errors: result.errors.length };
}

async function saveDeliveryData(records, filename) {
    if (store.useSupabase) {
        const result = await dataService.importCourierPerformance(records, filename);
        if (result.failed > 0) {
            console.warn('Import errors:', result.errors);
        }
    } else {
        // Save to localStorage
        store.deliveryData.all = [...store.deliveryData.all, ...records];
        helpers.saveToStorage('deliveryDataV4', store.deliveryData.all);
    }
}

async function savePickupData(records, filename) {
    if (store.useSupabase) {
        const result = await dataService.importPickupOrders(records, filename);
        if (result.failed > 0) {
            console.warn('Import errors:', result.errors);
        }
    } else {
        store.pickupData.all = [...store.pickupData.all, ...records];
        helpers.saveToStorage('pickupDataV1', store.pickupData.all);
    }
}

// =============================================
// Filtering
// =============================================

function populateFilters() {
    const data = store.allData;

    // Years
    const years = [...new Set(data
        .map(d => {
            const date = d.report_date || d.execution_date;
            return date ? new Date(date).getFullYear() : null;
        })
        .filter(Boolean)
    )].sort().reverse();

    const yearSelect = document.getElementById('filterYear');
    if (yearSelect) {
        yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    }

    // Zones/Departments (Delivery) or Countries (Pickup)
    if (store.isDeliveryMode()) {
        const departments = [...new Set(data.map(d => d.department).filter(Boolean))].sort();
        const zoneSelect = document.getElementById('filterZone');
        if (zoneSelect) {
            zoneSelect.innerHTML = '<option value="">All departments</option>' +
                departments.map(z => `<option value="${z}">${z}</option>`).join('');
        }

        const couriers = [...new Set(data.map(d => d.courier_name).filter(Boolean))].sort();
        const courierSelect = document.getElementById('filterCourier');
        if (courierSelect) {
            courierSelect.innerHTML = '<option value="">All couriers</option>' +
                couriers.map(c => `<option value="${c}">${c}</option>`).join('');
        }
    } else {
        const countries = [...new Set([
            ...data.map(d => d.sender_country),
            ...data.map(d => d.recipient_country)
        ].filter(Boolean))].sort();

        const zoneSelect = document.getElementById('filterZone');
        if (zoneSelect) {
            zoneSelect.innerHTML = '<option value="">All countries</option>' +
                countries.map(c => `<option value="${c}">${c}</option>`).join('');
        }
    }
}

function applyFilters() {
    const type = document.getElementById('filterType')?.value || 'this_month';
    const now = new Date();
    const data = store.allData;

    store.filteredData = data.filter(item => {
        const dateStr = item.report_date || item.execution_date;
        if (!dateStr) return false;

        const d = new Date(dateStr);
        let dateMatch = true;

        switch (type) {
            case 'all':
                dateMatch = true;
                break;
            case 'this_month':
                dateMatch = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                break;
            case 'last_month':
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                dateMatch = d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
                break;
            case 'this_week':
                const thisWeek = helpers.getWeekBounds(now);
                dateMatch = d >= thisWeek.start && d <= thisWeek.end;
                break;
            case 'year':
                const selectedYear = parseInt(document.getElementById('filterYear')?.value) || now.getFullYear();
                dateMatch = d.getFullYear() === selectedYear;
                break;
            case 'custom':
                const startStr = document.getElementById('dateStart')?.value;
                const endStr = document.getElementById('dateEnd')?.value;
                if (startStr && endStr) {
                    const start = new Date(startStr);
                    const end = new Date(endStr);
                    end.setHours(23, 59, 59);
                    dateMatch = d >= start && d <= end;
                }
                break;
        }

        if (!dateMatch) return false;

        // Additional filters
        if (store.isDeliveryMode()) {
            const deptFilter = document.getElementById('filterZone')?.value;
            if (deptFilter && item.department !== deptFilter) return false;

            const courierFilter = document.getElementById('filterCourier')?.value;
            if (courierFilter && item.courier_name !== courierFilter) return false;
        } else {
            const countryFilter = document.getElementById('filterZone')?.value;
            if (countryFilter && item.sender_country !== countryFilter && item.recipient_country !== countryFilter) {
                return false;
            }
        }

        return true;
    });

    store.setPage(1);
    store.displayData = [...store.filteredData];
    updateDashboard();
}

function toggleDateInputs() {
    const type = document.getElementById('filterType')?.value;

    const yearGroup = document.getElementById('yearSelectGroup');
    const startGroup = document.getElementById('dateStartGroup');
    const endGroup = document.getElementById('dateEndGroup');

    if (yearGroup) yearGroup.style.display = type === 'year' ? 'flex' : 'none';
    if (startGroup) startGroup.style.display = type === 'custom' ? 'flex' : 'none';
    if (endGroup) endGroup.style.display = type === 'custom' ? 'flex' : 'none';

    if (type !== 'custom') {
        applyFilters();
    }
}

// =============================================
// Dashboard Updates
// =============================================

function updateDashboard() {
    uiManager.updateStats();
    chartsManager.updateAll();
    tablesManager.renderRankingTable();
    uiManager.updateInsights();
    tablesManager.search(document.getElementById('tableSearch')?.value || '');
}

// =============================================
// Data Type Switching
// =============================================

function switchDataType(type) {
    if (type === store.activeDataType) return;

    store.setActiveDataType(type);
    updateDataTypeUI();
    loadData();
}

function updateDataTypeUI() {
    // Update toggle buttons
    document.querySelectorAll('.data-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === store.activeDataType);
    });

    // Show/hide chart grids
    const deliveryCharts = document.getElementById('deliveryCharts');
    const pickupCharts = document.getElementById('pickupCharts');

    if (deliveryCharts && pickupCharts) {
        if (store.isDeliveryMode()) {
            deliveryCharts.style.display = 'grid';
            pickupCharts.style.display = 'none';
        } else {
            deliveryCharts.style.display = 'none';
            pickupCharts.style.display = 'grid';
        }
    }

    // Update table headers
    updateTableHeaders();

    // Update filter labels
    const zoneLabel = document.getElementById('zoneFilterLabel');
    if (zoneLabel) {
        zoneLabel.textContent = store.isDeliveryMode() ? 'Department' : 'Country';
    }

    // Show/hide courier filter
    const courierGroup = document.getElementById('courierFilterGroup');
    if (courierGroup) {
        courierGroup.style.display = store.isDeliveryMode() ? 'flex' : 'none';
    }

    // Update ranking title
    const rankingTitle = document.getElementById('rankingTitle');
    if (rankingTitle) {
        rankingTitle.textContent = store.isDeliveryMode() ? 'Top 10 Couriers' : 'Top 10 Orders';
    }

    // Update ranking table headers
    const rankingHead = document.getElementById('rankingHead');
    if (rankingHead) {
        if (store.isDeliveryMode()) {
            rankingHead.innerHTML = `
                <tr>
                    <th>Rank</th>
                    <th>Courier</th>
                    <th>Vehicle</th>
                    <th>Loaded</th>
                    <th>Delivered</th>
                    <th>Success</th>
                </tr>
            `;
        } else {
            rankingHead.innerHTML = `
                <tr>
                    <th>Rank</th>
                    <th>Document</th>
                    <th>Country</th>
                    <th>Weight</th>
                    <th>Cost</th>
                    <th>Status</th>
                </tr>
            `;
        }
    }
}

function updateTableHeaders() {
    const headerRow = document.querySelector('#dataTable thead tr');
    if (!headerRow) return;

    if (store.isDeliveryMode()) {
        headerRow.innerHTML = `
            <th onclick="sortTable(0, 'date')">Date <i class="fas fa-sort"></i></th>
            <th onclick="sortTable(1)">Courier <i class="fas fa-sort"></i></th>
            <th onclick="sortTable(2)">Vehicle <i class="fas fa-sort"></i></th>
            <th onclick="sortTable(3)">Department <i class="fas fa-sort"></i></th>
            <th onclick="sortTable(4, 'number')">Loaded <i class="fas fa-sort"></i></th>
            <th onclick="sortTable(5, 'number')">Delivered <i class="fas fa-sort"></i></th>
            <th onclick="sortTable(6, 'number')">Success <i class="fas fa-sort"></i></th>
        `;
    } else {
        headerRow.innerHTML = `
            <th onclick="sortTable(0, 'date')">Date <i class="fas fa-sort"></i></th>
            <th onclick="sortTable(1)">Document <i class="fas fa-sort"></i></th>
            <th onclick="sortTable(2)">From <i class="fas fa-sort"></i></th>
            <th onclick="sortTable(3)">To <i class="fas fa-sort"></i></th>
            <th onclick="sortTable(4, 'number')">Weight <i class="fas fa-sort"></i></th>
            <th onclick="sortTable(5, 'number')">Cost <i class="fas fa-sort"></i></th>
            <th onclick="sortTable(6)">Status <i class="fas fa-sort"></i></th>
        `;
    }
}

// =============================================
// Event Listeners
// =============================================

function initializeEventListeners() {
    // File upload
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileUpload);
    }

    // Filter changes
    const filterType = document.getElementById('filterType');
    if (filterType) {
        filterType.addEventListener('change', toggleDateInputs);
    }

    // Search
    const tableSearch = document.getElementById('tableSearch');
    if (tableSearch) {
        tableSearch.addEventListener('input', helpers.debounce(() => {
            tablesManager.search(tableSearch.value);
        }, 300));
    }

    // Data type toggle
    document.querySelectorAll('.data-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchDataType(btn.dataset.type);
        });
    });

    // Connection status click to open settings
    const connectionStatus = document.getElementById('connectionStatus');
    if (connectionStatus) {
        connectionStatus.addEventListener('click', openSettings);
        connectionStatus.title = 'Click to configure database connection';
    }
}

// =============================================
// Tab Switching
// =============================================

function switchTab(tabName) {
    store.setActiveTab(tabName);
    uiManager.switchTab(tabName);

    // Update content based on tab
    if (tabName === 'insights') {
        uiManager.updateInsights();
    } else if (tabName === 'ranking') {
        tablesManager.renderRankingTable();
    } else if (tabName === 'data') {
        tablesManager.renderDataTable();
    }
}

// =============================================
// Export Functions
// =============================================

function exportData() {
    const data = store.filteredData;
    if (data.length === 0) {
        helpers.showToast('No data to export', 'error');
        return;
    }

    let exportData;
    if (store.isDeliveryMode()) {
        exportData = data.map(d => ({
            'Date': d.report_date,
            'Courier': d.courier_name,
            'Vehicle': d.car_number,
            'Department': d.department,
            'Loaded': d.loaded_parcels,
            'Delivered': d.delivered_parcels,
            'Success Rate': helpers.formatPercent(
                d.loaded_parcels > 0 ? (d.delivered_parcels / d.loaded_parcels * 100) : 0
            )
        }));
    } else {
        exportData = data.map(d => ({
            'Date': d.execution_date,
            'Document': d.pickup_doc_number,
            'From': d.sender_country,
            'To': d.recipient_country,
            'Weight': d.actual_weight,
            'Cost': d.delivery_cost,
            'Status': d.shipment_status
        }));
    }

    const filename = `${store.activeDataType}_export_${helpers.formatDate(new Date(), 'iso')}.xlsx`;
    helpers.exportToExcel(exportData, filename);
    helpers.showToast(`Exported ${exportData.length} records`, 'success');
}

async function clearAllData() {
    const dataType = store.isDeliveryMode() ? 'delivery' : 'pickup';
    if (!confirm(`Are you sure you want to delete ALL ${dataType} data? This action cannot be undone.`)) {
        return;
    }

    try {
        if (store.useSupabase) {
            await dataService.clearAllDeliveries();
            helpers.showToast('Database cleared', 'success');
        } else {
            const key = store.isDeliveryMode() ? 'deliveryDataV4' : 'pickupDataV1';
            localStorage.removeItem(key);
            helpers.showToast('Local data cleared', 'success');
        }

        // Reset state
        if (store.isDeliveryMode()) {
            store.deliveryData = { all: [], filtered: [], display: [] };
        } else {
            store.pickupData = { all: [], filtered: [], display: [] };
        }

        setTimeout(() => location.reload(), 1000);

    } catch (error) {
        console.error('Clear error:', error);
        helpers.showToast('Error clearing data: ' + error.message, 'error');
    }
}

// =============================================
// Global Exports for HTML onclick
// =============================================

window.applyFilters = applyFilters;
window.toggleDateInputs = toggleDateInputs;
window.switchTab = switchTab;
window.switchDataType = switchDataType;
window.searchTable = () => tablesManager.search(document.getElementById('tableSearch')?.value || '');
window.sortTable = (col, type) => tablesManager.sort(col, type);
window.changePage = (delta) => tablesManager.changePage(delta);
window.exportData = exportData;
window.clearAllData = clearAllData;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.saveSettings = saveSettings;
