// =============================================
// Charts Manager - Chart.js Visualization
// =============================================

import store from './store.js';
import { FILE_TYPES } from '../utils/constants.js';

/**
 * Manages all Chart.js charts in the application
 */
class ChartsManager {
    constructor() {
        this.defaultOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        font: { family: 'Inter, system-ui, sans-serif' }
                    }
                }
            }
        };

        this.colors = {
            primary: '#4f46e5',
            success: '#10b981',
            warning: '#f59e0b',
            danger: '#ef4444',
            gray: '#9ca3af',
            primaryLight: 'rgba(79, 70, 229, 0.1)',
            successLight: 'rgba(16, 185, 129, 0.1)'
        };
    }

    // ==========================================
    // Helper Methods
    // ==========================================

    getContext(canvasId) {
        const canvas = document.getElementById(canvasId);
        return canvas ? canvas.getContext('2d') : null;
    }

    formatDate(dateStr) {
        if (!dateStr) return 'Unknown';
        const date = new Date(dateStr);
        return date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
    }

    getSuccessRateColor(rate) {
        if (rate >= 95) return this.colors.success;
        if (rate >= 85) return this.colors.warning;
        return this.colors.danger;
    }

    // ==========================================
    // Main Update Method
    // ==========================================

    updateAll() {
        if (store.isDeliveryMode()) {
            this.updateDeliveryCharts();
        } else {
            this.updatePickupCharts();
        }
    }

    // ==========================================
    // Delivery Charts
    // ==========================================

    updateDeliveryCharts() {
        const data = store.deliveryData.filtered;
        if (!data || data.length === 0) return;

        this.renderTimelineChart(data);
        this.renderZoneChart(data);
        this.renderTrendChart(data);
        this.renderDistributionChart(data);
    }

    renderTimelineChart(data) {
        const ctx = this.getContext('timelineChart');
        if (!ctx) return;

        // Group by date
        const timelineData = {};
        data.forEach(d => {
            const date = d.report_date || d._dateStr?.split('T')[0] || 'Unknown';
            if (!timelineData[date]) timelineData[date] = { loaded: 0, delivered: 0 };
            timelineData[date].loaded += d.loaded_parcels || d._loaded || 0;
            timelineData[date].delivered += d.delivered_parcels || d._delivered || 0;
        });

        const labels = Object.keys(timelineData).sort();
        const displayLabels = labels.map(d => this.formatDate(d));

        store.setChart('timeline', new Chart(ctx, {
            type: 'line',
            data: {
                labels: displayLabels,
                datasets: [
                    {
                        label: 'Loaded',
                        data: labels.map(d => timelineData[d].loaded),
                        borderColor: this.colors.gray,
                        tension: 0.3,
                        borderWidth: 2,
                        pointRadius: 3
                    },
                    {
                        label: 'Delivered',
                        data: labels.map(d => timelineData[d].delivered),
                        borderColor: this.colors.primary,
                        backgroundColor: this.colors.primaryLight,
                        fill: true,
                        tension: 0.3,
                        borderWidth: 2,
                        pointRadius: 3
                    }
                ]
            },
            options: {
                ...this.defaultOptions,
                interaction: { mode: 'index', intersect: false }
            }
        }));
    }

    renderZoneChart(data) {
        const ctx = this.getContext('zoneChart');
        if (!ctx) return;

        const zoneStats = {};
        data.forEach(d => {
            const zone = d.department || d['Підрозділ відомості'] || 'Unknown';
            if (!zoneStats[zone]) zoneStats[zone] = { loaded: 0, delivered: 0 };
            zoneStats[zone].loaded += d.loaded_parcels || d._loaded || 0;
            zoneStats[zone].delivered += d.delivered_parcels || d._delivered || 0;
        });

        const zones = Object.keys(zoneStats).sort();
        const rates = zones.map(z =>
            zoneStats[z].loaded ? (zoneStats[z].delivered / zoneStats[z].loaded * 100) : 0
        );

        store.setChart('zone', new Chart(ctx, {
            type: 'bar',
            data: {
                labels: zones,
                datasets: [{
                    label: 'Success Rate (%)',
                    data: rates,
                    backgroundColor: rates.map(r => this.getSuccessRateColor(r)),
                    borderRadius: 4
                }]
            },
            options: {
                ...this.defaultOptions,
                scales: { y: { beginAtZero: true, max: 100 } }
            }
        }));
    }

    renderTrendChart(data) {
        const ctx = this.getContext('trendChart');
        if (!ctx) return;

        const sortedData = [...data].sort((a, b) => {
            const dateA = a.report_date || a._dateStr;
            const dateB = b.report_date || b._dateStr;
            return new Date(dateA) - new Date(dateB);
        });

        const dateGroups = {};
        sortedData.forEach(d => {
            const date = d.report_date || d._dateStr?.split('T')[0] || 'Unknown';
            if (!dateGroups[date]) dateGroups[date] = { loaded: 0, delivered: 0 };
            dateGroups[date].loaded += d.loaded_parcels || d._loaded || 0;
            dateGroups[date].delivered += d.delivered_parcels || d._delivered || 0;
        });

        const labels = Object.keys(dateGroups);
        const trendValues = labels.map(d => {
            const day = dateGroups[d];
            return day.loaded ? (day.delivered / day.loaded * 100) : 0;
        });

        store.setChart('trend', new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.map(d => this.formatDate(d)),
                datasets: [{
                    label: 'Success Rate (%)',
                    data: trendValues,
                    borderColor: this.colors.success,
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }]
            },
            options: {
                ...this.defaultOptions,
                scales: { y: { beginAtZero: false } }
            }
        }));
    }

    renderDistributionChart(data) {
        const ctx = this.getContext('distributionChart');
        if (!ctx) return;

        const buckets = { '<85%': 0, '85-95%': 0, '>95%': 0 };

        data.forEach(d => {
            const loaded = d.loaded_parcels || d._loaded || 0;
            const delivered = d.delivered_parcels || d._delivered || 0;
            const rate = loaded ? (delivered / loaded * 100) : 0;

            if (rate < 85) buckets['<85%']++;
            else if (rate < 95) buckets['85-95%']++;
            else buckets['>95%']++;
        });

        store.setChart('distribution', new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['< 85%', '85% - 95%', '> 95%'],
                datasets: [{
                    data: [buckets['<85%'], buckets['85-95%'], buckets['>95%']],
                    backgroundColor: [this.colors.danger, this.colors.warning, this.colors.success],
                    borderWidth: 0
                }]
            },
            options: {
                ...this.defaultOptions,
                cutout: '70%',
                plugins: { legend: { position: 'right' } }
            }
        }));
    }

    // ==========================================
    // Pickup Charts
    // ==========================================

    updatePickupCharts() {
        const data = store.pickupData.filtered;
        if (!data || data.length === 0) return;

        // Check if data is aggregated or raw
        const isAggregated = data[0]?.total_pickups !== undefined;

        if (isAggregated) {
            // Render charts for aggregated pickup data
            this.renderPickupCourierChart(data);
            this.renderPickupWeightChart(data);
            this.renderPickupSuccessChart(data);
            this.renderPickupTrendChart(data);
        } else {
            // Legacy: render charts for raw pickup data
            this.renderCountryChart(data);
            this.renderRevenueChart(data);
            this.renderStatusChart(data);
            this.renderWeightChart(data);
        }
    }

    // ==========================================
    // Pickup Charts (Aggregated Data)
    // Future Python Backend: These would use data from /pickup-aggregates endpoint
    // ==========================================

    renderPickupCourierChart(data) {
        const ctx = this.getContext('countryChart'); // Reuse canvas
        if (!ctx) return;

        // Aggregate by courier
        const courierStats = {};
        data.forEach(d => {
            const courier = d.courier_name || 'Unknown';
            if (!courierStats[courier]) courierStats[courier] = { total: 0, successful: 0 };
            courierStats[courier].total += d.total_pickups || 0;
            courierStats[courier].successful += d.success_count || 0;
        });

        // Calculate success rates
        const sorted = Object.entries(courierStats)
            .map(([courier, stats]) => ({
                courier,
                total: stats.total,
                rate: stats.total > 0 ? (stats.successful / stats.total * 100) : 0
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);

        store.setChart('country', new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sorted.map(s => s.courier),
                datasets: [{
                    label: 'Total Pickups',
                    data: sorted.map(s => s.total),
                    backgroundColor: this.colors.primary,
                    borderRadius: 4
                }]
            },
            options: {
                ...this.defaultOptions,
                indexAxis: 'y',
                plugins: {
                    ...this.defaultOptions.plugins,
                    title: {
                        display: true,
                        text: 'Pickups by Courier (Top 10)'
                    }
                }
            }
        }));
    }

    renderPickupWeightChart(data) {
        const ctx = this.getContext('weightChart');
        if (!ctx) return;

        // Group by date
        const weightByDate = {};
        data.forEach(d => {
            const date = d.execution_date || 'Unknown';
            if (!weightByDate[date]) weightByDate[date] = 0;
            weightByDate[date] += d.total_weight || 0;
        });

        const labels = Object.keys(weightByDate).sort();

        store.setChart('weight', new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.map(d => this.formatDate(d)),
                datasets: [{
                    label: 'Total Weight (kg)',
                    data: labels.map(d => weightByDate[d]),
                    backgroundColor: this.colors.primary,
                    borderRadius: 4
                }]
            },
            options: this.defaultOptions
        }));
    }

    renderPickupSuccessChart(data) {
        const ctx = this.getContext('statusChart');
        if (!ctx) return;

        // Calculate success rate buckets
        const buckets = { '<70%': 0, '70-90%': 0, '>90%': 0 };

        data.forEach(d => {
            const rate = d.success_rate || 0;
            if (rate < 70) buckets['<70%']++;
            else if (rate < 90) buckets['70-90%']++;
            else buckets['>90%']++;
        });

        store.setChart('status', new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['< 70%', '70% - 90%', '> 90%'],
                datasets: [{
                    data: [buckets['<70%'], buckets['70-90%'], buckets['>90%']],
                    backgroundColor: [this.colors.danger, this.colors.warning, this.colors.success],
                    borderWidth: 0
                }]
            },
            options: {
                ...this.defaultOptions,
                cutout: '60%',
                plugins: {
                    ...this.defaultOptions.plugins,
                    legend: { position: 'right' },
                    title: {
                        display: true,
                        text: 'Success Rate Distribution'
                    }
                }
            }
        }));
    }

    renderPickupTrendChart(data) {
        const ctx = this.getContext('revenueChart');
        if (!ctx) return;

        // Group by date and calculate daily success rate
        const dateStats = {};
        data.forEach(d => {
            const date = d.execution_date || 'Unknown';
            if (!dateStats[date]) dateStats[date] = { total: 0, successful: 0 };
            dateStats[date].total += d.total_pickups || 0;
            dateStats[date].successful += d.success_count || 0;
        });

        const labels = Object.keys(dateStats).sort();
        const rates = labels.map(d => {
            const stats = dateStats[d];
            return stats.total > 0 ? (stats.successful / stats.total * 100) : 0;
        });

        store.setChart('revenue', new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.map(d => this.formatDate(d)),
                datasets: [{
                    label: 'Success Rate (%)',
                    data: rates,
                    borderColor: this.colors.success,
                    backgroundColor: this.colors.successLight,
                    fill: true,
                    tension: 0.3,
                    borderWidth: 2
                }]
            },
            options: {
                ...this.defaultOptions,
                scales: {
                    y: { beginAtZero: false, max: 100 }
                }
            }
        }));
    }

    // ==========================================
    // Legacy Pickup Charts (Raw Data)
    // ==========================================

    renderCountryChart(data) {
        const ctx = this.getContext('countryChart');
        if (!ctx) return;

        const countryStats = {};
        data.forEach(d => {
            const country = d.recipient_country || 'Unknown';
            if (!countryStats[country]) countryStats[country] = 0;
            countryStats[country]++;
        });

        const sorted = Object.entries(countryStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        store.setChart('country', new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sorted.map(([country]) => country),
                datasets: [{
                    label: 'Orders',
                    data: sorted.map(([, count]) => count),
                    backgroundColor: this.colors.primary,
                    borderRadius: 4
                }]
            },
            options: {
                ...this.defaultOptions,
                indexAxis: 'y'
            }
        }));
    }

    renderRevenueChart(data) {
        const ctx = this.getContext('revenueChart');
        if (!ctx) return;

        const revenueByDate = {};
        data.forEach(d => {
            const date = d.execution_date || d.shipment_created_date || 'Unknown';
            if (!revenueByDate[date]) revenueByDate[date] = 0;
            revenueByDate[date] += d.delivery_cost || 0;
        });

        const labels = Object.keys(revenueByDate).sort();

        store.setChart('revenue', new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.map(d => this.formatDate(d)),
                datasets: [{
                    label: 'Revenue',
                    data: labels.map(d => revenueByDate[d]),
                    borderColor: this.colors.success,
                    backgroundColor: this.colors.successLight,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: this.defaultOptions
        }));
    }

    renderStatusChart(data) {
        const ctx = this.getContext('statusChart');
        if (!ctx) return;

        const statusStats = {};
        data.forEach(d => {
            const status = d.shipment_status || d.pickup_status || 'Unknown';
            if (!statusStats[status]) statusStats[status] = 0;
            statusStats[status]++;
        });

        const sorted = Object.entries(statusStats).sort((a, b) => b[1] - a[1]);
        const colors = [
            this.colors.success,
            this.colors.primary,
            this.colors.warning,
            this.colors.danger,
            this.colors.gray
        ];

        store.setChart('status', new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: sorted.map(([status]) => status),
                datasets: [{
                    data: sorted.map(([, count]) => count),
                    backgroundColor: sorted.map((_, i) => colors[i % colors.length]),
                    borderWidth: 0
                }]
            },
            options: {
                ...this.defaultOptions,
                cutout: '60%',
                plugins: { legend: { position: 'right' } }
            }
        }));
    }

    renderWeightChart(data) {
        const ctx = this.getContext('weightChart');
        if (!ctx) return;

        const weightByDate = {};
        data.forEach(d => {
            const date = d.execution_date || d.shipment_created_date || 'Unknown';
            if (!weightByDate[date]) weightByDate[date] = 0;
            weightByDate[date] += d.actual_weight || 0;
        });

        const labels = Object.keys(weightByDate).sort();

        store.setChart('weight', new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.map(d => this.formatDate(d)),
                datasets: [{
                    label: 'Weight (kg)',
                    data: labels.map(d => weightByDate[d]),
                    backgroundColor: this.colors.primary,
                    borderRadius: 4
                }]
            },
            options: this.defaultOptions
        }));
    }

    // ==========================================
    // Cleanup
    // ==========================================

    destroyAll() {
        store.destroyAllCharts();
    }
}

// Export singleton
const chartsManager = new ChartsManager();
export default chartsManager;

export { ChartsManager };
