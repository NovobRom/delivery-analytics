// =============================================
// Utility Functions
// =============================================

/**
 * Форматує число з роздільниками тисяч
 */
export function formatNumber(num) {
    return new Intl.NumberFormat('uk-UA').format(num);
}

/**
 * Форматує відсоток
 */
export function formatPercent(value, decimals = 1) {
    return `${Number(value).toFixed(decimals)}%`;
}

/**
 * Форматує дату для відображення
 */
export function formatDate(date, format = 'short') {
    if (!date) return '-';
    
    const d = new Date(date);
    
    if (format === 'short') {
        return d.toLocaleDateString('uk-UA');
    }
    
    if (format === 'long') {
        return d.toLocaleDateString('uk-UA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    
    if (format === 'iso') {
        return d.toISOString().split('T')[0];
    }
    
    return d.toLocaleDateString('uk-UA');
}

/**
 * Отримує межі тижня (понеділок - неділя)
 */
export function getWeekBounds(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    
    const monday = new Date(d);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    return { start: monday, end: sunday };
}

/**
 * Отримує межі місяця
 */
export function getMonthBounds(date) {
    const d = new Date(date);
    
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    
    return { start, end };
}

/**
 * Обчислює success rate
 */
export function calculateSuccessRate(loaded, delivered) {
    if (!loaded || loaded === 0) return 0;
    return (delivered / loaded) * 100;
}

/**
 * Повертає CSS клас для badge залежно від rate
 */
export function getRateBadgeClass(rate) {
    if (rate >= 95) return 'badge-success';
    if (rate >= 85) return 'badge-warning';
    return 'badge-danger';
}

/**
 * Повертає CSS клас для тренду
 */
export function getTrendClass(current, previous) {
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return '';
}

/**
 * Debounce функція
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle функція
 */
export function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Глибоке копіювання об'єкта
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Генерує унікальний ID
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Зберігає дані в localStorage
 */
export function saveToStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (e) {
        console.error('Storage save error:', e);
        return false;
    }
}

/**
 * Отримує дані з localStorage
 */
export function loadFromStorage(key, defaultValue = null) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
        console.error('Storage load error:', e);
        return defaultValue;
    }
}

/**
 * Експортує дані в Excel
 */
export function exportToExcel(data, filename = 'export.xlsx') {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, filename);
}

/**
 * Показує toast повідомлення
 */
export function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('notification') || createToastContainer();
    
    container.textContent = message;
    container.className = `notification show ${type}`;
    
    setTimeout(() => {
        container.className = 'notification';
    }, duration);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'notification';
    container.className = 'notification';
    document.body.appendChild(container);
    return container;
}

/**
 * Групує масив по ключу
 */
export function groupBy(array, key) {
    return array.reduce((groups, item) => {
        const value = typeof key === 'function' ? key(item) : item[key];
        (groups[value] = groups[value] || []).push(item);
        return groups;
    }, {});
}

/**
 * Сортує масив об'єктів по ключу
 */
export function sortBy(array, key, order = 'asc') {
    return [...array].sort((a, b) => {
        const valueA = typeof key === 'function' ? key(a) : a[key];
        const valueB = typeof key === 'function' ? key(b) : b[key];
        
        if (valueA < valueB) return order === 'asc' ? -1 : 1;
        if (valueA > valueB) return order === 'asc' ? 1 : -1;
        return 0;
    });
}

/**
 * Сума масиву по ключу
 */
export function sumBy(array, key) {
    return array.reduce((sum, item) => {
        const value = typeof key === 'function' ? key(item) : item[key];
        return sum + (Number(value) || 0);
    }, 0);
}

/**
 * Середнє значення масиву по ключу
 */
export function avgBy(array, key) {
    if (array.length === 0) return 0;
    return sumBy(array, key) / array.length;
}
