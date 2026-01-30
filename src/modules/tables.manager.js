// =============================================
// Tables Manager - Data Tables & Pagination
// =============================================

import store from './store.js';
import * as helpers from '../utils/helpers.js';
import { FILE_TYPES } from '../utils/constants.js';

/**
 * Manages data tables, sorting, and pagination
 */
class TablesManager {
    constructor() {
        this.sortDirection = 1;
        this.lastSortedColumn = -1;
    }

    // ==========================================
    // Main Render Methods
    // ==========================================

    renderDataTable() {
        if (store.isDeliveryMode()) {
            this.renderDeliveryTable();
        } else {
            this.renderPickupTable();
        }
    }

    renderDeliveryTable() {
        const tbody = document.getElementById('tableBody');
        if (!tbody) return;

        const data = store.displayData;
        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = this.getEmptyRow(7);
            this.updatePaginationInfo(0);
            return;
        }

        const start = (store.ui.currentPage - 1) * store.ui.rowsPerPage;
        const end = start + store.ui.rowsPerPage;
        const pageItems = data.slice(start, end);

        pageItems.forEach(row => {
            const loaded = row.loaded_parcels || row._loaded || 0;
            const delivered = row.delivered_parcels || row._delivered || 0;
            const rate = loaded > 0 ? (delivered / loaded * 100) : 0;
            const badgeClass = helpers.getRateBadgeClass(rate);

            const date = row.report_date || row._dateStr;
            const courierName = row.courier_name || row["ПІБ кур'єра"];
            const carNumber = row.car_number || row['Номер авто'] || '-';
            const department = row.department || row['Підрозділ відомості'] || '-';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${helpers.formatDate(new Date(date))}</td>
                <td style="font-weight: 500">${courierName}</td>
                <td>${carNumber}</td>
                <td>${department}</td>
                <td>${loaded}</td>
                <td>${delivered}</td>
                <td><span class="badge ${badgeClass}">${helpers.formatPercent(rate)}</span></td>
            `;
            tbody.appendChild(tr);
        });

        this.updatePaginationInfo(data.length);
    }

    renderPickupTable() {
        const tbody = document.getElementById('tableBody');
        if (!tbody) return;

        const data = store.displayData;
        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = this.getEmptyRow(7);
            this.updatePaginationInfo(0);
            return;
        }

        const start = (store.ui.currentPage - 1) * store.ui.rowsPerPage;
        const end = start + store.ui.rowsPerPage;
        const pageItems = data.slice(start, end);

        pageItems.forEach(row => {
            const date = row.execution_date || row.shipment_created_date || '-';
            const docNumber = row.pickup_doc_number || row.shipment_number || '-';
            const senderCountry = row.sender_country || '-';
            const recipientCountry = row.recipient_country || '-';
            const weight = row.actual_weight || 0;
            const cost = row.delivery_cost || 0;
            const status = row.shipment_status || row.pickup_status || '-';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${helpers.formatDate(new Date(date))}</td>
                <td style="font-weight: 500">${docNumber}</td>
                <td>${senderCountry}</td>
                <td>${recipientCountry}</td>
                <td>${weight.toFixed(2)} kg</td>
                <td>${cost.toFixed(2)} ${row.delivery_currency || 'UAH'}</td>
                <td><span class="badge badge-info">${status}</span></td>
            `;
            tbody.appendChild(tr);
        });

        this.updatePaginationInfo(data.length);
    }

    // ==========================================
    // Ranking Table
    // ==========================================

    renderRankingTable() {
        if (store.isDeliveryMode()) {
            this.renderCourierRanking();
        } else {
            this.renderCountryRanking();
        }
    }

    renderCourierRanking() {
        const tbody = document.getElementById('rankingBody');
        if (!tbody) return;

        const data = store.filteredData;
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-message">Load data to view ranking</td></tr>';
            return;
        }

        // Aggregate by courier
        const courierStats = {};
        data.forEach(d => {
            const name = d.courier_name || d["ПІБ кур'єра"];
            const vehicle = d.car_number || d['Номер авто'] || '-';
            if (!courierStats[name]) {
                courierStats[name] = { vehicle, loaded: 0, delivered: 0 };
            }
            courierStats[name].loaded += d.loaded_parcels || d._loaded || 0;
            courierStats[name].delivered += d.delivered_parcels || d._delivered || 0;
        });

        // Sort by success rate
        const sorted = Object.entries(courierStats)
            .map(([name, stats]) => ({
                name,
                vehicle: stats.vehicle,
                loaded: stats.loaded,
                delivered: stats.delivered,
                rate: stats.loaded > 0 ? (stats.delivered / stats.loaded * 100) : 0
            }))
            .filter(c => c.loaded >= 50)
            .sort((a, b) => b.rate - a.rate)
            .slice(0, 10);

        if (sorted.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-message">Not enough data for ranking</td></tr>';
            return;
        }

        tbody.innerHTML = sorted.map((c, i) => {
            const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
            const badgeClass = helpers.getRateBadgeClass(c.rate);
            return `
                <tr>
                    <td><span class="rank-badge ${rankClass}">${i + 1}</span></td>
                    <td style="font-weight: 500">${c.name}</td>
                    <td>${c.vehicle}</td>
                    <td>${helpers.formatNumber(c.loaded)}</td>
                    <td>${helpers.formatNumber(c.delivered)}</td>
                    <td><span class="badge ${badgeClass}">${helpers.formatPercent(c.rate)}</span></td>
                </tr>
            `;
        }).join('');
    }

    renderCountryRanking() {
        const tbody = document.getElementById('rankingBody');
        if (!tbody) return;

        const data = store.filteredData;
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-message">Load data to view ranking</td></tr>';
            return;
        }

        // Aggregate by country
        const countryStats = {};
        data.forEach(d => {
            const country = d.recipient_country || 'Unknown';
            if (!countryStats[country]) {
                countryStats[country] = { orders: 0, weight: 0, revenue: 0 };
            }
            countryStats[country].orders++;
            countryStats[country].weight += d.actual_weight || 0;
            countryStats[country].revenue += d.delivery_cost || 0;
        });

        // Sort by orders
        const sorted = Object.entries(countryStats)
            .map(([country, stats]) => ({
                country,
                orders: stats.orders,
                weight: stats.weight,
                revenue: stats.revenue
            }))
            .sort((a, b) => b.orders - a.orders)
            .slice(0, 10);

        tbody.innerHTML = sorted.map((c, i) => {
            const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
            return `
                <tr>
                    <td><span class="rank-badge ${rankClass}">${i + 1}</span></td>
                    <td style="font-weight: 500">${c.country}</td>
                    <td>${helpers.formatNumber(c.orders)}</td>
                    <td>${c.weight.toFixed(2)} kg</td>
                    <td>${c.revenue.toFixed(2)}</td>
                </tr>
            `;
        }).join('');
    }

    // ==========================================
    // Search
    // ==========================================

    search(query) {
        const searchLower = (query || '').toLowerCase();
        const data = store.filteredData;

        if (!searchLower) {
            store.displayData = [...data];
        } else if (store.isDeliveryMode()) {
            store.displayData = data.filter(r => {
                const name = r.courier_name || r["ПІБ кур'єра"] || '';
                const vehicle = r.car_number || r['Номер авто'] || '';
                return name.toLowerCase().includes(searchLower) ||
                       vehicle.toLowerCase().includes(searchLower);
            });
        } else {
            store.displayData = data.filter(r => {
                const doc = r.pickup_doc_number || r.shipment_number || '';
                const sender = r.sender_country || '';
                const recipient = r.recipient_country || '';
                return doc.toLowerCase().includes(searchLower) ||
                       sender.toLowerCase().includes(searchLower) ||
                       recipient.toLowerCase().includes(searchLower);
            });
        }

        store.setPage(1);
        this.renderDataTable();
    }

    // ==========================================
    // Sorting
    // ==========================================

    sort(columnIndex, type = 'string') {
        if (this.lastSortedColumn === columnIndex) {
            this.sortDirection *= -1;
        } else {
            this.sortDirection = 1;
            this.lastSortedColumn = columnIndex;
        }

        // Update sort icons
        document.querySelectorAll('th i.fa-sort, th i.fa-sort-up, th i.fa-sort-down').forEach(i => {
            i.className = 'fas fa-sort';
        });
        const icons = document.querySelectorAll('th i');
        if (icons[columnIndex]) {
            icons[columnIndex].className = this.sortDirection === 1 ? 'fas fa-sort-up' : 'fas fa-sort-down';
        }

        const data = store.displayData;

        data.sort((a, b) => {
            let x, y;

            if (store.isDeliveryMode()) {
                x = this.getDeliverySortValue(a, columnIndex, type);
                y = this.getDeliverySortValue(b, columnIndex, type);
            } else {
                x = this.getPickupSortValue(a, columnIndex, type);
                y = this.getPickupSortValue(b, columnIndex, type);
            }

            if (x < y) return -1 * this.sortDirection;
            if (x > y) return 1 * this.sortDirection;
            return 0;
        });

        store.displayData = data;
        this.renderDataTable();
    }

    getDeliverySortValue(row, columnIndex, type) {
        switch (columnIndex) {
            case 0: // Date
                const date = row.report_date || row._dateStr;
                return date ? new Date(date).getTime() : 0;
            case 1: // Courier
                return (row.courier_name || row["ПІБ кур'єра"] || '').toLowerCase();
            case 2: // Vehicle
                return (row.car_number || row['Номер авто'] || '').toLowerCase();
            case 3: // Department
                return (row.department || row['Підрозділ відомості'] || '').toLowerCase();
            case 4: // Loaded
                return row.loaded_parcels || row._loaded || 0;
            case 5: // Delivered
                return row.delivered_parcels || row._delivered || 0;
            case 6: // Rate
                const loaded = row.loaded_parcels || row._loaded || 0;
                const delivered = row.delivered_parcels || row._delivered || 0;
                return loaded > 0 ? delivered / loaded : 0;
            default:
                return '';
        }
    }

    getPickupSortValue(row, columnIndex, type) {
        switch (columnIndex) {
            case 0: // Date
                const date = row.execution_date || row.shipment_created_date;
                return date ? new Date(date).getTime() : 0;
            case 1: // Document
                return (row.pickup_doc_number || row.shipment_number || '').toLowerCase();
            case 2: // Sender country
                return (row.sender_country || '').toLowerCase();
            case 3: // Recipient country
                return (row.recipient_country || '').toLowerCase();
            case 4: // Weight
                return row.actual_weight || 0;
            case 5: // Cost
                return row.delivery_cost || 0;
            case 6: // Status
                return (row.shipment_status || row.pickup_status || '').toLowerCase();
            default:
                return '';
        }
    }

    // ==========================================
    // Pagination
    // ==========================================

    changePage(delta) {
        const newPage = store.ui.currentPage + delta;
        const totalPages = Math.ceil(store.displayData.length / store.ui.rowsPerPage);

        if (newPage >= 1 && newPage <= totalPages) {
            store.setPage(newPage);
            this.renderDataTable();
        }
    }

    updatePaginationInfo(totalItems) {
        const btnPrev = document.getElementById('btnPrev');
        const btnNext = document.getElementById('btnNext');
        const pageInfo = document.getElementById('pageInfo');

        if (!pageInfo) return;

        if (totalItems === 0) {
            pageInfo.textContent = 'No records';
            if (btnPrev) btnPrev.disabled = true;
            if (btnNext) btnNext.disabled = true;
            return;
        }

        const start = (store.ui.currentPage - 1) * store.ui.rowsPerPage + 1;
        const end = Math.min(start + store.ui.rowsPerPage - 1, totalItems);
        const totalPages = Math.ceil(totalItems / store.ui.rowsPerPage);

        pageInfo.textContent = `${start}-${end} of ${totalItems}`;

        if (btnPrev) btnPrev.disabled = store.ui.currentPage === 1;
        if (btnNext) btnNext.disabled = store.ui.currentPage >= totalPages;
    }

    // ==========================================
    // Helpers
    // ==========================================

    getEmptyRow(colspan) {
        return `<tr><td colspan="${colspan}" class="empty-message">No data found</td></tr>`;
    }
}

// Export singleton
const tablesManager = new TablesManager();
export default tablesManager;

export { TablesManager };
