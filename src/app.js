// =============================================
// Delivery Analytics Pro - Main Application
// =============================================

import supabaseService from './services/supabase.service.js';
import excelParser from './services/excel-parser.service.js';
import * as helpers from './utils/helpers.js';

// =============================================
// Application State
// =============================================

const state = {
    // Data
    allData: [],
    filteredData: [],
    displayData: [],
    
    // UI State
    activeTab: 'overview',
    currentPage: 1,
    rowsPerPage: 15,
    
    // Charts
    charts: {},
    
    // Filters
    filters: {
        type: 'this_month',
        year: null,
        startDate: null,
        endDate: null,
        zone: null,
        courier: null
    },
    
    // Operation mode
    useSupabase: false, // true = database, false = localStorage
    
    // Validation
    validationIssues: []
};

// =============================================
// Initialization
// =============================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚚 Delivery Analytics Pro starting...');
    
    // Check if Supabase is configured
    await checkSupabaseConnection();
    
    // Load data
    await loadData();
    
    // Initialize UI
    initializeEventListeners();
    
    console.log('✅ Application ready');
});

/**
 * Checks connection to Supabase
 */
async function checkSupabaseConnection() {
    try {
        // Try to fetch zones to verify connection
        const zones = await supabaseService.getZones();
        state.useSupabase = true;
        console.log('✅ Supabase connected');
        
        // Show connection indicator
        updateConnectionStatus(true);
    } catch (error) {
        state.useSupabase = false;
        console.log('⚠️ Supabase not available, using localStorage');
        updateConnectionStatus(false);
    }
}

/**
 * Updates the connection indicator
 */
function updateConnectionStatus(connected) {
    const indicator = document.getElementById('connectionStatus');
    if (indicator) {
        indicator.innerHTML = connected
            ? '<i class="fas fa-cloud"></i> Online'
            : '<i class="fas fa-database"></i> Local';
        indicator.className = connected ? 'status-online' : 'status-offline';
    }
}

// =============================================
// Data Loading
// =============================================

/**
 * Loads data from the appropriate source
 */
async function loadData() {
    showLoading(true);
    
    try {
        if (state.useSupabase) {
            await loadFromSupabase();
        } else {
            loadFromLocalStorage();
        }
        
        populateFilters();
        applyFilters();
        
    } catch (error) {
        console.error('Load error:', error);
        helpers.showToast('Помилка завантаження даних', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Loads data from Supabase
 */
async function loadFromSupabase() {
    const deliveries = await supabaseService.getDeliveries();
    
    state.allData = deliveries.map(d => ({
        id: d.id,
        _dateObj: new Date(d.delivery_date),
        _dateStr: d.delivery_date,
        "ПІБ кур'єра": d.couriers?.full_name || 'Unknown',
        'Номер авто': d.couriers?.vehicle_number || '-',
        'Підрозділ відомості': d.zones?.name || '-',
        _loaded: d.loaded_count,
        _delivered: d.delivered_count
    }));
    
    helpers.showToast(`Завантажено ${state.allData.length} записів з бази`, 'success');
}

/**
 * Loads data from localStorage
 */
function loadFromLocalStorage() {
    const stored = helpers.loadFromStorage('deliveryDataV4');
    
    if (stored && stored.length > 0) {
        state.allData = stored.map(row => ({
            ...row,
            _dateObj: row._dateStr ? new Date(row._dateStr) : null
        }));
        helpers.showToast(`Завантажено ${state.allData.length} записів`, 'info');
    }
}

// =============================================
// File Upload
// =============================================

/**
 * Handles file upload
 */
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    showLoading(true);
    
    try {
        // Parse the file
        const result = await excelParser.parseFile(file);
        
        // Show warnings
        if (result.warnings.length > 0) {
            displayValidationAlerts(result.warnings, 'warning');
        }
        
        if (result.errors.length > 0) {
            displayValidationAlerts(result.errors, 'error');
        }
        
        // Save data
        if (result.records.length > 0) {
            if (state.useSupabase) {
                await saveToSupabase(result.records);
            } else {
                saveToLocalStorage(result.records);
            }
            
            await loadData();
            
            helpers.showToast(
                `Імпортовано ${result.records.length} записів`, 
                result.errors.length > 0 ? 'warning' : 'success'
            );
        } else {
            helpers.showToast('Не знайдено валідних записів', 'error');
        }
        
    } catch (error) {
        console.error('Upload error:', error);
        helpers.showToast('Помилка обробки файлу: ' + error.message, 'error');
    } finally {
        showLoading(false);
        event.target.value = ''; // Reset input
    }
}

/**
 * Saves records to Supabase
 */
async function saveToSupabase(records) {
    const result = await supabaseService.importDeliveries(records, (progress) => {
        updateProgressBar(progress.percent);
    });
    
    if (result.failed > 0) {
        console.warn('Import errors:', result.errors);
        helpers.showToast(`Помилки при імпорті: ${result.failed}`, 'warning');
    }
}

/**
 * Saves records to localStorage
 */
function saveToLocalStorage(records) {
    // Convert format
    const converted = records.map(r => ({
        "ПІБ кур'єра": r.courierName,
        'Номер авто': r.vehicleNumber,
        'Підрозділ відомості': r.zoneName,
        _dateObj: r._dateObj,
        _dateStr: r.deliveryDate,
        _loaded: r.loadedCount,
        _delivered: r.deliveredCount
    }));
    
    // Add to existing
    state.allData = [...state.allData, ...converted];
    state.allData.sort((a, b) => new Date(b._dateStr) - new Date(a._dateStr));
    
    // Save
    helpers.saveToStorage('deliveryDataV4', state.allData);
}

// =============================================
// Filtering
// =============================================

/**
 * Populates filters
 */
function populateFilters() {
    // Years
    const years = [...new Set(state.allData
        .filter(d => d._dateObj)
        .map(d => d._dateObj.getFullYear())
    )].sort().reverse();
    
    const yearSelect = document.getElementById('filterYear');
    if (yearSelect) {
        yearSelect.innerHTML = years.map(y => 
            `<option value="${y}">${y}</option>`
        ).join('');
    }
    
    // Zones
    const zones = [...new Set(state.allData
        .map(d => d['Підрозділ відомості'])
        .filter(Boolean)
    )].sort();
    
    const zoneSelect = document.getElementById('filterZone');
    if (zoneSelect) {
        zoneSelect.innerHTML = '<option value="">Всі зони</option>' + 
            zones.map(z => `<option value="${z}">${z}</option>`).join('');
    }
    
    // Couriers
    const couriers = [...new Set(state.allData
        .map(d => d["ПІБ кур'єра"])
        .filter(Boolean)
    )].sort();
    
    const courierSelect = document.getElementById('filterCourier');
    if (courierSelect) {
        courierSelect.innerHTML = '<option value="">Всі курʼєри</option>' + 
            couriers.map(c => `<option value="${c}">${c}</option>`).join('');
    }
}

/**
 * Applies filters
 */
function applyFilters() {
    const type = document.getElementById('filterType')?.value || 'this_month';
    const now = new Date();
    
    state.filteredData = state.allData.filter(item => {
        if (!item._dateObj) return false;
        const d = item._dateObj;
        
        // Filter by period
        let dateMatch = true;
        switch (type) {
            case 'all':
                dateMatch = true;
                break;
            case 'this_month':
                dateMatch = d.getMonth() === now.getMonth() && 
                           d.getFullYear() === now.getFullYear();
                break;
            case 'last_month':
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                dateMatch = d.getMonth() === lastMonth.getMonth() && 
                           d.getFullYear() === lastMonth.getFullYear();
                break;
            case 'this_week':
                const thisWeek = helpers.getWeekBounds(now);
                dateMatch = d >= thisWeek.start && d <= thisWeek.end;
                break;
            case 'last_week':
                const lastWeekDate = new Date(now);
                lastWeekDate.setDate(now.getDate() - 7);
                const lastWeek = helpers.getWeekBounds(lastWeekDate);
                dateMatch = d >= lastWeek.start && d <= lastWeek.end;
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
        
        // Filter by zone
        const zoneFilter = document.getElementById('filterZone')?.value;
        if (zoneFilter && item['Підрозділ відомості'] !== zoneFilter) {
            return false;
        }
        
        // Filter by courier
        const courierFilter = document.getElementById('filterCourier')?.value;
        if (courierFilter && item["ПІБ кур'єра"] !== courierFilter) {
            return false;
        }
        
        return true;
    });
    
    state.currentPage = 1;
    updateDashboard();
}

/**
 * Toggles date input visibility
 */
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

/**
 * Updates the entire dashboard
 */
function updateDashboard() {
    updateStats();
    updateCharts();
    searchTable();
}

/**
 * Updates statistics
 */
function updateStats() {
    const data = state.filteredData;
    
    const totalLoaded = helpers.sumBy(data, '_loaded');
    const totalDelivered = helpers.sumBy(data, '_delivered');
    const rate = helpers.calculateSuccessRate(totalLoaded, totalDelivered);
    
    const uniqueCouriers = new Set(data.map(d => d["ПІБ кур'єра"])).size;
    const uniqueDays = new Set(data.map(d => d._dateStr?.split('T')[0])).size;
    
    const statsGrid = document.getElementById('statsGrid');
    if (statsGrid) {
        statsGrid.innerHTML = `
            <div class="stat-card">
                <span class="stat-label">Всього посилок</span>
                <span class="stat-value">${helpers.formatNumber(totalLoaded)}</span>
                <span class="stat-sub">Завантажено за період</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Доставлено</span>
                <span class="stat-value">${helpers.formatNumber(totalDelivered)}</span>
                <span class="stat-sub up"><i class="fas fa-check-circle"></i> ${helpers.formatPercent(rate)} успіху</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Активних курʼєрів</span>
                <span class="stat-value">${uniqueCouriers}</span>
                <span class="stat-sub">За цей період</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Днів доставки</span>
                <span class="stat-value">${uniqueDays}</span>
                <span class="stat-sub">Дні з активністю</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Недоставлено</span>
                <span class="stat-value">${helpers.formatNumber(totalLoaded - totalDelivered)}</span>
                <span class="stat-sub down">${helpers.formatPercent(100 - rate)} від загальної</span>
            </div>
        `;
    }
}

/**
 * Updates charts (Chart.js)
 */
function updateCharts() {
    const data = state.filteredData;
    
    // If no data, do not draw anything, but prevent crash
    if (!data || data.length === 0) return;

    // Helper to safely get context
    const getCtx = (id) => {
        const canvas = document.getElementById(id);
        return canvas ? canvas.getContext('2d') : null;
    };

    // 1. Delivery Dynamics (Timeline)
    const ctxTimeline = getCtx('timelineChart');
    if (ctxTimeline) {
        // Group by date
        const timelineData = {};
        data.forEach(d => {
            const date = d._dateStr ? d._dateStr.split('T')[0] : 'Unknown';
            if (!timelineData[date]) timelineData[date] = { loaded: 0, delivered: 0 };
            timelineData[date].loaded += d._loaded;
            timelineData[date].delivered += d._delivered;
        });
        
        const labels = Object.keys(timelineData).sort();
        const displayLabels = labels.map(d => new Date(d).toLocaleDateString('uk-UA', {day: '2-digit', month: '2-digit'}));
        
        if (state.charts.timeline) state.charts.timeline.destroy();
        state.charts.timeline = new Chart(ctxTimeline, {
            type: 'line',
            data: {
                labels: displayLabels,
                datasets: [
                    { 
                        label: 'Завантажено', 
                        data: labels.map(d => timelineData[d].loaded), 
                        borderColor: '#9ca3af', 
                        tension: 0.3,
                        borderWidth: 2,
                        pointRadius: 3
                    },
                    { 
                        label: 'Доставлено', 
                        data: labels.map(d => timelineData[d].delivered), 
                        borderColor: '#4f46e5', 
                        backgroundColor: 'rgba(79, 70, 229, 0.1)', 
                        fill: true,
                        tension: 0.3,
                        borderWidth: 2,
                        pointRadius: 3
                    }
                ]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false }
            }
        });
    }

    // 2. Success by Zones (Bar Chart)
    const ctxZone = getCtx('zoneChart');
    if (ctxZone) {
        const zoneStats = {};
        data.forEach(d => {
            const zone = d['Підрозділ відомості'] || 'Невизначено';
            if (!zoneStats[zone]) zoneStats[zone] = { loaded: 0, delivered: 0 };
            zoneStats[zone].loaded += d._loaded;
            zoneStats[zone].delivered += d._delivered;
        });

        const zones = Object.keys(zoneStats).sort();
        const rates = zones.map(z => zoneStats[z].loaded ? (zoneStats[z].delivered / zoneStats[z].loaded * 100) : 0);

        if (state.charts.zone) state.charts.zone.destroy();
        state.charts.zone = new Chart(ctxZone, {
            type: 'bar',
            data: {
                labels: zones,
                datasets: [{
                    label: 'Success Rate (%)',
                    data: rates,
                    backgroundColor: rates.map(r => r >= 95 ? '#10b981' : r >= 85 ? '#f59e0b' : '#ef4444'),
                    borderRadius: 4
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, max: 100 } } 
            }
        });
    }

    // 3. Success Trend (Line Chart)
    const ctxTrend = getCtx('trendChart');
    if (ctxTrend) {
        // Sort data by date for trend
        const sortedData = [...data].sort((a, b) => new Date(a._dateStr) - new Date(b._dateStr));
        const dateGroups = {};
        
        sortedData.forEach(d => {
            const date = d._dateStr ? d._dateStr.split('T')[0] : 'Unknown';
            if (!dateGroups[date]) dateGroups[date] = { l: 0, d: 0 };
            dateGroups[date].l += d._loaded;
            dateGroups[date].d += d._delivered;
        });

        const labels = Object.keys(dateGroups);
        const trendValues = labels.map(d => {
            const day = dateGroups[d];
            return day.l ? (day.d / day.l * 100) : 0;
        });

        if (state.charts.trend) state.charts.trend.destroy();
        state.charts.trend = new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: labels.map(d => new Date(d).toLocaleDateString('uk-UA', {day: '2-digit', month: '2-digit'})),
                datasets: [{
                    label: 'Успішність (%)',
                    data: trendValues,
                    borderColor: '#10b981',
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: false } }
            }
        });
    }

    // 4. Distribution (Doughnut)
    const ctxDist = getCtx('distributionChart');
    if (ctxDist) {
        // Calculate success rate for each record separately
        let buckets = { '<85%': 0, '85-95%': 0, '>95%': 0 };
        
        data.forEach(d => {
            const rate = d._loaded ? (d._delivered / d._loaded * 100) : 0;
            if (rate < 85) buckets['<85%']++;
            else if (rate < 95) buckets['85-95%']++;
            else buckets['>95%']++;
        });

        if (state.charts.distribution) state.charts.distribution.destroy();
        state.charts.distribution = new Chart(ctxDist, {
            type: 'doughnut',
            data: {
                labels: ['< 85%', '85% - 95%', '> 95%'],
                datasets: [{
                    data: [buckets['<85%'], buckets['85-95%'], buckets['>95%']],
                    backgroundColor: ['#ef4444', '#f59e0b', '#10b981'],
                    borderWidth: 0
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { legend: { position: 'right' } }
            }
        });
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
        tableSearch.addEventListener('input', helpers.debounce(searchTable, 300));
    }
}

// =============================================
// UI Helpers
// =============================================

function showLoading(show) {
    const loader = document.getElementById('loadingOverlay');
    if (loader) {
        loader.style.display = show ? 'flex' : 'none';
    }
}

function updateProgressBar(percent) {
    const bar = document.getElementById('progressBar');
    if (bar) {
        bar.style.width = `${percent}%`;
        bar.textContent = `${percent}%`;
    }
}

function displayValidationAlerts(issues, type = 'warning') {
    const container = document.getElementById('alertContainer');
    if (!container) return;
    
    const alertsHtml = issues.slice(0, 5).map(issue => `
        <div class="alert alert-${type}">
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'exclamation-triangle'}"></i>
            <span>${issue.message || issue}</span>
        </div>
    `).join('');
    
    container.innerHTML = alertsHtml;
}

// =============================================
// Export global functions for HTML onclick
// =============================================

window.applyFilters = applyFilters;
window.toggleDateInputs = toggleDateInputs;
window.switchTab = switchTab;
window.searchTable = searchTable;
window.sortTable = sortTable;
window.changePage = changePage;
window.exportData = exportData;
window.clearAllData = clearAllData;

function switchTab(tabName) {
    state.activeTab = tabName;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    document.querySelector(`.tab[onclick*="${tabName}"]`)?.classList.add('active');
    document.getElementById(`tab-${tabName}`)?.classList.add('active');
    
    // If switched to comparison or ranking - specific updates can be added here
    // updateDashboard(); // Already called by general cycle, but can be separated for optimization
}

function searchTable() {
    const search = document.getElementById('tableSearch')?.value?.toLowerCase() || '';
    
    state.displayData = state.filteredData.filter(r => {
        if (!search) return true;
        return (r["ПІБ кур'єра"] || '').toLowerCase().includes(search) ||
               (r['Номер авто'] || '').toLowerCase().includes(search);
    });
    
    state.currentPage = 1;
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (state.displayData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px; color: var(--text-light)">Даних не знайдено</td></tr>';
        updatePaginationInfo(0);
        return;
    }

    const start = (state.currentPage - 1) * state.rowsPerPage;
    const end = start + state.rowsPerPage;
    const pageItems = state.displayData.slice(start, end);

    pageItems.forEach(row => {
        const rate = row._loaded > 0 ? (row._delivered / row._loaded * 100) : 0;
        const badgeClass = helpers.getRateBadgeClass(rate);
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${helpers.formatDate(row._dateObj)}</td>
            <td style="font-weight: 500">${row["ПІБ кур'єра"]}</td>
            <td>${row['Номер авто']}</td>
            <td>${row['Підрозділ відомості']}</td>
            <td>${row._loaded}</td>
            <td>${row._delivered}</td>
            <td><span class="badge ${badgeClass}">${helpers.formatPercent(rate)}</span></td>
        `;
        tbody.appendChild(tr);
    });

    updatePaginationInfo(state.displayData.length);
}

function updatePaginationInfo(totalItems) {
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');
    const pageInfo = document.getElementById('pageInfo');
    
    if (!pageInfo) return;

    if (totalItems === 0) {
        pageInfo.textContent = 'Немає записів';
        if (btnPrev) btnPrev.disabled = true;
        if (btnNext) btnNext.disabled = true;
        return;
    }

    const start = (state.currentPage - 1) * state.rowsPerPage + 1;
    const end = Math.min(start + state.rowsPerPage - 1, totalItems);

    pageInfo.textContent = `Показано ${start}-${end} з ${totalItems}`;
    
    if (btnPrev) btnPrev.disabled = state.currentPage === 1;
    if (btnNext) btnNext.disabled = end >= totalItems;
}

// Sort State
let sortDir = 1;
let lastCol = -1;

function sortTable(n, type) {
    if (lastCol === n) { sortDir *= -1; } 
    else { sortDir = 1; lastCol = n; }

    // Update icons
    document.querySelectorAll('th i').forEach(i => i.className = 'fas fa-sort');
    const clickedHeaderIcon = document.querySelectorAll('th i')[n];
    if (clickedHeaderIcon) {
        clickedHeaderIcon.className = sortDir === 1 ? 'fas fa-sort-up' : 'fas fa-sort-down';
    }

    state.displayData.sort((a, b) => {
        let x, y;

        if (type === 'date') {
            x = a._dateObj ? a._dateObj.getTime() : 0;
            y = b._dateObj ? b._dateObj.getTime() : 0;
        } else if (n === 4 || n === 5) { // Numbers loaded/delivered
            // Get value directly by index or property
            const key = n === 4 ? '_loaded' : '_delivered';
            x = a[key]; y = b[key];
        } else if (n === 6) { // Success rate
            x = a._loaded > 0 ? a._delivered/a._loaded : 0;
            y = b._loaded > 0 ? b._delivered/b._loaded : 0;
        } else {
            // String columns mapping
            const keys = ["", "ПІБ кур'єра", "Номер авто", "Підрозділ відомості"];
            x = (a[keys[n]] || '').toLowerCase();
            y = (b[keys[n]] || '').toLowerCase();
        }

        if (x < y) return -1 * sortDir;
        if (x > y) return 1 * sortDir;
        return 0;
    });

    renderTable();
}

function changePage(delta) {
    state.currentPage += delta;
    renderTable();
}

function exportData() {
    if (state.filteredData.length === 0) {
        helpers.showToast('Немає даних для експорту', 'error');
        return;
    }
    
    const exportData = state.filteredData.map(d => ({
        'Дата': helpers.formatDate(d._dateObj),
        'Курʼєр': d["ПІБ кур'єра"],
        'Авто': d['Номер авто'],
        'Зона': d['Підрозділ відомості'],
        'Завантажено': d._loaded,
        'Доставлено': d._delivered,
        'Успішність': helpers.formatPercent(helpers.calculateSuccessRate(d._loaded, d._delivered))
    }));
    
    helpers.exportToExcel(exportData, `delivery_export_${helpers.formatDate(new Date(), 'iso')}.xlsx`);
    helpers.showToast(`Експортовано ${exportData.length} записів`, 'success');
}

async function clearAllData() {
    if (confirm('Ви впевнені, що хочете видалити ВСІ дані? Цю дію не можна скасувати.')) {
        try {
            if (state.useSupabase) {
                // Wait for the clear operation to finish
                await supabaseService.clearAllDeliveries();
                helpers.showToast('Базу даних очищено', 'success');
            } else {
                localStorage.removeItem('deliveryDataV4');
                helpers.showToast('Локальні дані очищено', 'success');
            }
            
            // Reset state
            state.allData = [];
            state.filteredData = [];
            state.displayData = [];
            
            // Reload page to refresh everything
            setTimeout(() => location.reload(), 1000);
            
        } catch (error) {
            console.error('Clear error:', error);
            helpers.showToast('Помилка очищення: ' + error.message, 'error');
        }
    }
}