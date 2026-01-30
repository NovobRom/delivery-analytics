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
    // Дані
    allData: [],
    filteredData: [],
    displayData: [],
    
    // UI стан
    activeTab: 'overview',
    currentPage: 1,
    rowsPerPage: 15,
    
    // Графіки
    charts: {},
    
    // Фільтри
    filters: {
        type: 'this_month',
        year: null,
        startDate: null,
        endDate: null,
        zone: null,
        courier: null
    },
    
    // Режим роботи
    useSupabase: false, // true = база даних, false = localStorage
    
    // Validation
    validationIssues: []
};

// =============================================
// Initialization
// =============================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚚 Delivery Analytics Pro starting...');
    
    // Перевіряємо чи налаштований Supabase
    await checkSupabaseConnection();
    
    // Завантажуємо дані
    await loadData();
    
    // Ініціалізуємо UI
    initializeEventListeners();
    
    console.log('✅ Application ready');
});

/**
 * Перевіряє підключення до Supabase
 */
async function checkSupabaseConnection() {
    try {
        // Пробуємо отримати зони для перевірки підключення
        const zones = await supabaseService.getZones();
        state.useSupabase = true;
        console.log('✅ Supabase connected');
        
        // Показуємо індикатор підключення
        updateConnectionStatus(true);
    } catch (error) {
        state.useSupabase = false;
        console.log('⚠️ Supabase not available, using localStorage');
        updateConnectionStatus(false);
    }
}

/**
 * Оновлює індикатор підключення
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
 * Завантажує дані з відповідного джерела
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
 * Завантажує дані з Supabase
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
 * Завантажує дані з localStorage
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
 * Обробляє завантаження файлу
 */
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    showLoading(true);
    
    try {
        // Парсимо файл
        const result = await excelParser.parseFile(file);
        
        // Показуємо попередження
        if (result.warnings.length > 0) {
            displayValidationAlerts(result.warnings, 'warning');
        }
        
        if (result.errors.length > 0) {
            displayValidationAlerts(result.errors, 'error');
        }
        
        // Зберігаємо дані
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
 * Зберігає записи в Supabase
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
 * Зберігає записи в localStorage
 */
function saveToLocalStorage(records) {
    // Конвертуємо формат
    const converted = records.map(r => ({
        "ПІБ кур'єра": r.courierName,
        'Номер авто': r.vehicleNumber,
        'Підрозділ відомості': r.zoneName,
        _dateObj: r._dateObj,
        _dateStr: r.deliveryDate,
        _loaded: r.loadedCount,
        _delivered: r.deliveredCount
    }));
    
    // Додаємо до існуючих
    state.allData = [...state.allData, ...converted];
    state.allData.sort((a, b) => new Date(b._dateStr) - new Date(a._dateStr));
    
    // Зберігаємо
    helpers.saveToStorage('deliveryDataV4', state.allData);
}

// =============================================
// Filtering
// =============================================

/**
 * Заповнює фільтри
 */
function populateFilters() {
    // Роки
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
    
    // Зони
    const zones = [...new Set(state.allData
        .map(d => d['Підрозділ відомості'])
        .filter(Boolean)
    )].sort();
    
    const zoneSelect = document.getElementById('filterZone');
    if (zoneSelect) {
        zoneSelect.innerHTML = '<option value="">Всі зони</option>' + 
            zones.map(z => `<option value="${z}">${z}</option>`).join('');
    }
    
    // Курʼєри
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
 * Застосовує фільтри
 */
function applyFilters() {
    const type = document.getElementById('filterType')?.value || 'this_month';
    const now = new Date();
    
    state.filteredData = state.allData.filter(item => {
        if (!item._dateObj) return false;
        const d = item._dateObj;
        
        // Фільтр по періоду
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
        
        // Фільтр по зоні
        const zoneFilter = document.getElementById('filterZone')?.value;
        if (zoneFilter && item['Підрозділ відомості'] !== zoneFilter) {
            return false;
        }
        
        // Фільтр по курʼєру
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
 * Перемикає видимість полів дати
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
 * Оновлює весь дашборд
 */
function updateDashboard() {
    updateStats();
    updateCharts();
    searchTable();
}

/**
 * Оновлює статистику
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

// Placeholder functions (to be implemented)
function switchTab(tabName) {
    state.activeTab = tabName;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    document.querySelector(`.tab[onclick*="${tabName}"]`)?.classList.add('active');
    document.getElementById(`tab-${tabName}`)?.classList.add('active');
    
    updateDashboard();
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
    // Implementation from original file
    console.log('Rendering table with', state.displayData.length, 'items');
}

function sortTable(col, type) {
    console.log('Sorting by column', col);
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

function clearAllData() {
    if (confirm('Ви впевнені, що хочете видалити ВСІ дані? Цю дію не можна скасувати.')) {
        localStorage.removeItem('deliveryDataV4');
        state.allData = [];
        state.filteredData = [];
        state.displayData = [];
        location.reload();
    }
}

function updateCharts() {
    // Charts implementation
    console.log('Updating charts');
}
