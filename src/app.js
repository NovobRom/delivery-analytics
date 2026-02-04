// =============================================
// Delivery Analytics Pro v2.0
// Main Application Entry Point
// =============================================
//
// PYTHON BACKEND MIGRATION STRATEGY:
// ===================================
// This application currently parses Excel files client-side and stores data locally.
// For production deployment with Python FastAPI backend:
//
// 1. DATA INGESTION:
//    - Replace handleFileUpload() with API call to POST /api/upload
//    - Backend will handle Excel parsing using openpyxl or pandas
//    - Backend will validate data and store in PostgreSQL/Supabase
//
// 2. DATA AGGREGATION:
//    - Pickup data aggregation (currently in excel-parser.service.js)
//      should move to backend SQL queries
//    - Create endpoint: GET /api/pickup-aggregates
//      Query: SELECT courier_name, execution_date, COUNT(*) as total_pickups,
//             SUM(actual_weight) as total_weight, COUNT(CASE WHEN status='Done' THEN 1 END)
//             FROM pickup_orders GROUP BY courier_name, execution_date
//
// 3. DATA RETRIEVAL:
//    - Replace loadDeliveryData() with: GET /api/deliveries?filter=...
//    - Replace loadPickupData() with: GET /api/pickups?filter=...
//    - Backend handles filtering, pagination, sorting
//
// 4. STATISTICS:
//    - Replace store.getDeliveryStats() with: GET /api/stats/delivery
//    - Replace store.getPickupStats() with: GET /api/stats/pickup
//    - Backend calculates stats using SQL aggregations
//
// 5. DATA SCHEMA (for Python models):
//    See models defined in excel-parser.service.js parseDeliveryRow() and parsePickupRow()
//    These map directly to SQLAlchemy/Pydantic models
//
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

    try {
        // Initialize UI manager
        uiManager.init();

        // Check connection to Supabase
        await checkConnection();

        // Load initial data
        await loadData();

        // Initialize event listeners
        initializeEventListeners();

        // Update UI
        updateVersion();
        updateDataTypeUI();

        console.log('✅ Application ready');
    } catch (error) {
        console.error('❌ Initialization error:', error);
        helpers.showToast('Error loading application', 'error');
    }
});

/**
 * Check connection to Supabase
 */
async function checkConnection() {
    uiManager.showLoading(true);

    try {
        const connectionType = await dataService.checkConnection();
        // Force API mode
        store.setConnection(connectionType, true);
        uiManager.updateConnectionStatus(connectionType);
        console.log('Connection type:', connectionType);

        if (connectionType === 'local') {
            console.warn('Supabase not reachable, check env vars');
            helpers.showToast('Database connection failed', 'error');
        }
    } catch (error) {
        console.error('Connection check failed:', error);
        store.setConnection('api', false);
        uiManager.updateConnectionStatus('error');
        helpers.showToast('Backend connection failed', 'error');
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
    try {
        const data = await dataService.getCourierPerformance();
        store.deliveryData.all = data;
        if (data.length > 0) {
            helpers.showToast(`Loaded ${data.length} delivery records`, 'success');
        } else {
            helpers.showToast('No delivery records found', 'info');
        }
    } catch (e) {
        console.error('Failed to load from Supabase:', e);
        helpers.showToast('Failed to load delivery data', 'error');
    }
}

async function loadPickupData() {
    try {
        const data = await dataService.getPickupOrders();
        store.pickupData.all = data;
        if (data.length > 0) {
            helpers.showToast(`Loaded ${data.length} pickup orders`, 'success');
        } else {
            helpers.showToast('No pickup orders found', 'info');
        }
    } catch (e) {
        console.error('Failed to load from Supabase:', e);
        helpers.showToast('Failed to load pickup data', 'error');
    }
}

// =============================================
// File Upload
// =============================================
// Future Python Backend Integration Point:
// Replace the entire client-side parsing logic below with:
//
// async function handleFileUpload(event) {
//     const formData = new FormData();
//     for (const file of event.target.files) {
//         formData.append('files', file);
//     }
//
//     const response = await fetch('/api/upload', {
//         method: 'POST',
//         body: formData
//     });
//
//     const result = await response.json();
//     // Backend returns: { fileType, recordsProcessed, errors, warnings }
//     // Then reload data from backend
//     await loadData();
// }
// =============================================

async function handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    console.log(`📁 Processing ${files.length} file(s)...`);
    uiManager.showLoading(true);

    try {
        let processedCount = 0;
        let errors = [];

        for (const file of files) {
            try {
                // 1. Detect Type Client-Side (Preview)
                helpers.showToast(`Analyzing ${file.name}...`, 'info');
                const fileType = await excelParser.detectTypeFromFile(file);

                if (fileType === FILE_TYPES.UNKNOWN) {
                    throw new Error('Unknown file format. Please check file headers against Source A/B specs.');
                }

                const typeLabel = fileType === FILE_TYPES.SHIPMENTS ? 'Shipments (Source A)' : 'Events (Source B)';
                console.log(`Dedicated type: ${typeLabel}`);

                // 2. Upload to Backend
                helpers.showToast(`Uploading as ${typeLabel}...`, 'info');
                const result = await excelParser.uploadToBackend(file, fileType);

                // 3. Handle Result
                if (result.success) {
                    processedCount += result.imported_records;
                    helpers.showToast(`Imported ${result.imported_records} records from ${file.name}`, 'success');
                } else {
                    errors.push(`${file.name}: ${result.errors.length} errors (see console)`);
                    console.error('Import errors:', result.errors);
                }

                if (result.skipped_records > 0) {
                    console.warn(`Skipped ${result.skipped_records} records in ${file.name}`);
                }

            } catch (err) {
                console.error(`Error processing file ${file.name}:`, err);
                errors.push(`${file.name}: ${err.message}`);
            }
        }

        if (errors.length > 0) {
            uiManager.showAlert(`Errors occurred:<br/>${errors.slice(0, 3).join('<br/>')}`, 'error');
        }

        if (processedCount > 0) {
            // Reload data to reflect changes
            await loadData();
            uiManager.showAlert(`Successfully processed ${processedCount} records!`, 'success');
        }

    } catch (globalError) {
        console.error('Global upload error:', globalError);
        uiManager.showAlert('Critical error during upload', 'error');
    } finally {
        // Reset file input
        event.target.value = '';
        uiManager.showLoading(false);
    }
}



async function saveDeliveryData(records) {
    await dataService.importCourierPerformance(records);
}

async function savePickupData(records) {
    await dataService.importPickupOrders(records);
}

// =============================================
// Filtering
// =============================================

function populateFilters() {
    const data = store.allData;
    if (!data || data.length === 0) return;

    // Years
    const years = [...new Set(data
        .map(d => {
            const date = d.report_date || d.execution_date;
            return date ? new Date(date).getFullYear() : null;
        })
        .filter(Boolean)
    )].sort().reverse();

    const yearSelect = document.getElementById('filterYear');
    if (yearSelect && years.length > 0) {
        yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    }

    // Departments/Countries
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
    const type = document.getElementById('filterType')?.value || 'all';
    const now = new Date();
    const data = store.allData;

    if (!data || data.length === 0) {
        store.filteredData = [];
        store.displayData = [];
        updateDashboard();
        return;
    }

    store.filteredData = data.filter(item => {
        const dateStr = item.report_date || item.execution_date;
        if (!dateStr) return type === 'all';

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
    try {
        uiManager.updateStats();
        chartsManager.updateAll();
        tablesManager.renderRankingTable();
        uiManager.updateInsights();
        tablesManager.search(document.getElementById('tableSearch')?.value || '');
    } catch (e) {
        console.error('Dashboard update error:', e);
    }
}

// =============================================
// Data Type Switching
// =============================================

function switchDataType(type) {
    console.log('Switching to:', type);
    if (type === store.activeDataType) return;

    store.setActiveDataType(type);
    updateDataTypeUI();
    loadData();
}

function updateDataTypeUI() {
    // Update toggle buttons
    document.querySelectorAll('.data-type-btn').forEach(btn => {
        const isActive = btn.dataset.type === store.activeDataType;
        btn.classList.toggle('active', isActive);
    });

    // Show/hide chart grids
    const deliveryCharts = document.getElementById('deliveryCharts');
    const pickupCharts = document.getElementById('pickupCharts');

    if (deliveryCharts) {
        deliveryCharts.style.display = store.isDeliveryMode() ? 'grid' : 'none';
    }
    if (pickupCharts) {
        pickupCharts.style.display = store.isDeliveryMode() ? 'none' : 'grid';
    }

    // Update filter labels
    const zoneLabel = document.getElementById('zoneFilterLabel');
    if (zoneLabel) {
        zoneLabel.textContent = store.isDeliveryMode() ? 'Department' : 'Country';
    }

    // Show/hide courier filter (only for delivery)
    const courierGroup = document.getElementById('courierFilterGroup');
    if (courierGroup) {
        courierGroup.style.display = store.isDeliveryMode() ? 'flex' : 'none';
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
        console.log('✓ File input listener attached');
    }

    // Filter type change
    const filterType = document.getElementById('filterType');
    if (filterType) {
        filterType.addEventListener('change', toggleDateInputs);
    }

    // Search input
    const tableSearch = document.getElementById('tableSearch');
    if (tableSearch) {
        tableSearch.addEventListener('input', helpers.debounce(() => {
            tablesManager.search(tableSearch.value);
        }, 300));
    }

    // Data type toggle buttons
    document.querySelectorAll('.data-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            console.log('Toggle clicked:', type);
            switchDataType(type);
        });
        console.log('✓ Toggle button listener attached:', btn.dataset.type);
    });
}

// =============================================
// Tab Switching
// =============================================

function switchTab(tabName) {
    store.setActiveTab(tabName);
    uiManager.switchTab(tabName);

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
    if (!data || data.length === 0) {
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
    if (!confirm(`Delete ALL ${dataType} data? This cannot be undone.`)) {
        return;
    }

    try {
        if (store.isDeliveryMode()) {
            await dataService.clearAllDeliveries();
        } else {
            await dataService.clearAllPickups();
        }
        helpers.showToast('Database cleared', 'success');

        // Reset state
        if (store.isDeliveryMode()) {
            store.deliveryData = { all: [], filtered: [], display: [] };
        } else {
            store.pickupData = { all: [], filtered: [], display: [] };
        }

        setTimeout(() => location.reload(), 1000);

    } catch (error) {
        console.error('Clear error:', error);
        helpers.showToast('Error: ' + error.message, 'error');
    }
}

// =============================================
// Global Exports for HTML onclick handlers
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
