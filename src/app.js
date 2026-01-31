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

    // Check connection
    await checkConnection();

    // Load data
    await loadData();

    // Initialize event listeners
    initializeEventListeners();

    // Update version display
    updateVersion();

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
// File Upload
// =============================================

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    uiManager.showLoading(true);

    try {
        // Parse the file (auto-detects type)
        const result = await excelParser.parseFile(file);

        console.log(`📁 File type detected: ${result.fileType}`);
        console.log(`📊 Records parsed: ${result.stats.processed}`);

        // Show warnings/errors
        if (result.warnings.length > 0) {
            uiManager.showAlerts(result.warnings, 'warning');
        }
        if (result.errors.length > 0) {
            uiManager.showAlerts(result.errors, 'error');
        }

        if (result.records.length === 0) {
            helpers.showToast('No valid records found', 'error');
            return;
        }

        // Switch to correct data type
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

        // Reload and update UI
        await loadData();

        const typeLabel = result.fileType === FILE_TYPES.DELIVERY ? 'delivery' : 'pickup';
        helpers.showToast(
            `Imported ${result.records.length} ${typeLabel} records`,
            result.errors.length > 0 ? 'warning' : 'success'
        );

    } catch (error) {
        console.error('Upload error:', error);
        helpers.showToast('Error processing file: ' + error.message, 'error');
    } finally {
        uiManager.showLoading(false);
        event.target.value = '';
    }
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

    // Update table headers
    updateTableHeaders();

    // Update filter labels
    const zoneLabel = document.querySelector('label[for="filterZone"]');
    if (zoneLabel) {
        zoneLabel.textContent = store.isDeliveryMode() ? 'Department' : 'Country';
    }

    // Show/hide courier filter
    const courierGroup = document.getElementById('courierFilterGroup');
    if (courierGroup) {
        courierGroup.style.display = store.isDeliveryMode() ? 'flex' : 'none';
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
