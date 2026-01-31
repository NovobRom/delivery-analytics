// =============================================
// Excel Parser Service v2.0
// Supports: Delivery Reports & Pickup Orders
// Auto-detection of file type
// =============================================

import {
    FILE_TYPE_MARKERS,
    DELIVERY_COLUMN_MAP,
    PICKUP_COLUMN_MAP,
    DATE_PATTERNS,
    CURRENCY_PATTERN,
    FILE_TYPES,
    DEFAULTS
} from '../utils/constants.js';

class ExcelParserService {

    constructor() {
        this.lastDetectedType = null;
    }

    // ==========================================
    // FILE TYPE DETECTION
    // ==========================================

    /**
     * Detects file type based on column headers
     * @param {string[]} headers - Array of column headers from Excel
     * @returns {string} - FILE_TYPES.DELIVERY, FILE_TYPES.PICKUP, or FILE_TYPES.UNKNOWN
     */
    detectFileType(headers) {
        const headerStr = headers.join(' ').toLowerCase();

        // Check for delivery markers
        const deliveryMatches = FILE_TYPE_MARKERS.DELIVERY.filter(marker =>
            headerStr.includes(marker.toLowerCase())
        );

        // Check for pickup markers
        const pickupMatches = FILE_TYPE_MARKERS.PICKUP.filter(marker =>
            headerStr.includes(marker.toLowerCase())
        );

        if (deliveryMatches.length >= 2) {
            this.lastDetectedType = FILE_TYPES.DELIVERY;
            return FILE_TYPES.DELIVERY;
        }

        if (pickupMatches.length >= 2) {
            this.lastDetectedType = FILE_TYPES.PICKUP;
            return FILE_TYPES.PICKUP;
        }

        this.lastDetectedType = FILE_TYPES.UNKNOWN;
        return FILE_TYPES.UNKNOWN;
    }

    // ==========================================
    // DATE PARSING & NORMALIZATION
    // ==========================================

    /**
     * Parses date from various formats and normalizes to ISO
     * @param {any} rawDate - Date value from Excel
     * @returns {string|null} - ISO date string (YYYY-MM-DD) or null
     */
    parseDate(rawDate) {
        if (!rawDate) return null;

        // Excel serial number (days since 1900-01-01)
        if (typeof rawDate === 'number') {
            const date = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
            return this.formatDateISO(date);
        }

        // Already a Date object
        if (rawDate instanceof Date) {
            return this.formatDateISO(rawDate);
        }

        // String parsing
        if (typeof rawDate === 'string') {
            const cleanStr = rawDate.trim();

            // Try each pattern
            for (const pattern of DATE_PATTERNS) {
                const match = cleanStr.match(pattern.regex);
                if (match) {
                    let year, month, day;

                    switch (pattern.format) {
                        case 'DD-MM-YYYY':
                        case 'DD.MM.YYYY':
                        case 'DD/MM/YYYY':
                            day = parseInt(match[1], 10);
                            month = parseInt(match[2], 10) - 1;
                            year = parseInt(match[3], 10);
                            break;
                        case 'YYYY-MM-DD':
                            year = parseInt(match[1], 10);
                            month = parseInt(match[2], 10) - 1;
                            day = parseInt(match[3], 10);
                            break;
                    }

                    const date = new Date(year, month, day);
                    if (!isNaN(date.getTime())) {
                        return this.formatDateISO(date);
                    }
                }
            }

            // Fallback: try standard Date parsing
            const standardDate = new Date(cleanStr);
            if (!isNaN(standardDate.getTime())) {
                return this.formatDateISO(standardDate);
            }
        }

        return null;
    }

    /**
     * Formats date to ISO string (YYYY-MM-DD)
     */
    formatDateISO(date) {
        if (!date || isNaN(date.getTime())) return null;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // ==========================================
    // VALUE PARSING
    // ==========================================

    /**
     * Parses currency value (e.g., "4.66 EUR" -> { amount: 4.66, currency: "EUR" })
     */
    parseCurrency(value) {
        if (!value) return { amount: null, currency: DEFAULTS.CURRENCY };

        const str = String(value).trim();
        const match = str.match(CURRENCY_PATTERN);

        if (match) {
            const amount = parseFloat(match[1].replace(',', '.'));
            const currency = match[2] || DEFAULTS.CURRENCY;
            return { amount: isNaN(amount) ? null : amount, currency };
        }

        // Try direct number parsing
        const num = parseFloat(str.replace(',', '.'));
        return { amount: isNaN(num) ? null : num, currency: DEFAULTS.CURRENCY };
    }

    /**
     * Parses integer value safely
     */
    parseInt(value) {
        if (value === null || value === undefined || value === '') return 0;
        const num = parseInt(String(value).replace(/[^\d-]/g, ''), 10);
        return isNaN(num) ? 0 : num;
    }

    /**
     * Parses float value safely
     */
    parseFloat(value) {
        if (value === null || value === undefined || value === '') return 0;
        const num = parseFloat(String(value).replace(',', '.').replace(/[^\d.-]/g, ''));
        return isNaN(num) ? 0 : num;
    }

    /**
     * Parses percentage value (e.g., "95%" -> 95, "0.95" -> 95)
     */
    parsePercentage(value) {
        if (!value) return 0;
        const str = String(value).trim();

        // Remove % sign and parse
        const num = parseFloat(str.replace('%', '').replace(',', '.'));
        if (isNaN(num)) return 0;

        // If value is less than 1, assume it's a decimal (0.95 -> 95)
        return num < 1 && num > 0 ? num * 100 : num;
    }

    // ==========================================
    // ROW PARSING
    // ==========================================

    /**
     * Maps Excel row to database fields using column map
     */
    mapRowToFields(row, columnMap) {
        const result = {};

        for (const [excelCol, dbField] of Object.entries(columnMap)) {
            if (dbField.startsWith('_')) continue; // Skip internal fields

            const value = row[excelCol];
            if (value !== undefined && value !== null && value !== '') {
                result[dbField] = value;
            }
        }

        return result;
    }

    /**
     * Parses a delivery report row
     */
    parseDeliveryRow(row) {
        const mapped = this.mapRowToFields(row, DELIVERY_COLUMN_MAP);

        return {
            report_date: this.parseDate(row['Дата відомості']),
            courier_name: row["ПІБ кур'єра"]?.toString().trim() || null,
            car_number: row['Номер авто']?.toString().trim() || null,
            department: row['Підрозділ відомості']?.toString().trim() || null,
            reports_count: this.parseInt(row['К-сть відомостей']),
            addresses_count: this.parseInt(row['К-сть адрес']),
            loaded_parcels: this.parseInt(row['К-сть завантажених ШК']),
            delivered_parcels: this.parseInt(row['К-сть доставлених ШК на дату відомості']),
            delivered_in_hand: this.parseInt(row['К-сть доставлених ШК на дату відомості "В руки"']),
            delivered_safe_place: this.parseInt(row['К-сть доставлених ШК на дату відомості "SafePlace"']),
            undelivered_parcels: this.parseInt(row['К-сть недоставлених ШК на дату відомості']),
            undelivered_with_reason: this.parseInt(row['К-сть недоставлених ШК з причиною']),
            undelivered_no_reason: this.parseInt(row['К-сть недоставлених ШК без причини']),
            delivery_success_rate: this.parsePercentage(row['Відсоток доставлених ШК'])
        };
    }

    /**
     * Parses a pickup order row
     */
    parsePickupRow(row) {
        const costData = this.parseCurrency(row['Вартість доставки']);

        return {
            pickup_doc_number: row['Номер документу PickUp']?.toString().trim() || null,
            shipments_in_doc: this.parseInt(row['Кількість шипментів у документі PickUp']) || 1,
            execution_date: this.parseDate(row['Дата виконання документу PickUp']),
            time_interval: row['Замовлений часовий інтервал']?.toString().trim() || null,
            creation_source: row['Джерело створення']?.toString().trim() || null,
            first_warehouse: row['Перший логістичний склад']?.toString().trim() || null,
            shipment_number: row['Номер Shipment']?.toString().trim() || null,
            places_count: this.parseInt(row['Кількість мість']) || 1,
            shipment_created_date: this.parseDate(row['Дата створення Shipment']),
            shipment_department: row['Підрозділ створення Shipment']?.toString().trim() || null,
            first_scan_date: this.parseDate(row['Дата першого сканування в ОМ']),
            first_scan_warehouse: row['Склад першого сканування']?.toString().trim() || null,
            planned_delivery_date: this.parseDate(row['Планова дата доставки (РДД)']),
            sender_country: row['Країна відправника']?.toString().trim() || null,
            sender_type: row['Тип відправника']?.toString().trim() || null,
            sender_company: row['Компанія відправник']?.toString().trim() || null,
            sender_city: row['Місто відправника']?.toString().trim() || null,
            sender_address: row['Адреса відправника']?.toString().trim() || null,
            shipment_type: row['Тип відправлення']?.toString().trim() || null,
            shipment_description: row['Опис відправлення']?.toString().trim() || null,
            declared_value: this.parseFloat(row['Оголошена вартість відправлення']),
            actual_weight: this.parseFloat(row['Загальна фактична вага відправлення']),
            volumetric_weight: this.parseFloat(row["Загальна об'ємна вага відправлення"]),
            dimensions: row['Довжина, см*Ширина, см*Висота, см']?.toString().trim() || null,
            recipient_country: row['Країна отримувача']?.toString().trim() || null,
            recipient_type: row['Тип отримувача']?.toString().trim() || null,
            pickup_status: row['Останній статус документу PickUp']?.toString().trim() || null,
            pickup_status_date: this.parseDate(row['Дата останнього статусу документу PickUp']),
            courier_name: row["Прізвище та ім'я кур'єра"]?.toString().trim() || null,
            partner_pickup_number: row['Номер заявки на забір партнера першої милі']?.toString().trim() || null,
            partner_shipment_number: row['Номер шипменту партнера першої милі']?.toString().trim() || null,
            delivery_cost: costData.amount,
            delivery_currency: costData.currency,
            payer: row['Платник']?.toString().trim() || null,
            payment_doc_number: row['Номер документу оплати']?.toString().trim() || null,
            payment_doc_status: row['Останній статус документу оплати']?.toString().trim() || null,
            payment_doc_status_date: this.parseDate(row['Дата останнього статусу документу оплати']),
            shipment_payment_status: row['Статус оплати Shipment']?.toString().trim() || null,
            shipment_payment_date: this.parseDate(row['Дата отримання статусу оплати в Shipment']),
            shipment_status: row['Останній статус Shipment']?.toString().trim() || null,
            shipment_status_date: this.parseDate(row['Дата останнього статусу Shipment']),
            verification_result: row['Результат перевірки відправлення']?.toString().trim() || null,
            acceptance_date: this.parseDate(row['Дата приймання відправлення']),
            last_scan_date: this.parseDate(row['Дата останнього сканування в ОМ']),
            last_scan_department: row['Підрозділ останнього сканування в ОМ']?.toString().trim() || null,
            last_scan_report: row['Номер, назва та статус відомості останнього сканування']?.toString().trim() || null,
            execution_speed: row['Швидкість виконання']?.toString().trim() || null,
            non_execution_reason: row['Причини не виконання загалом/день-в-день']?.toString().trim() || null
        };
    }

    // ==========================================
    // VALIDATION
    // ==========================================

    /**
     * Validates a delivery row
     */
    validateDeliveryRow(row) {
        const issues = [];

        if (!row.courier_name) {
            issues.push('Missing courier name');
        }
        if (!row.report_date) {
            issues.push('Invalid or missing date');
        }
        if (row.loaded_parcels < 0) {
            issues.push('Negative loaded count');
        }
        if (row.delivered_parcels > row.loaded_parcels) {
            issues.push('Delivered exceeds loaded');
        }

        return { isValid: issues.length === 0, issues };
    }

    /**
     * Validates a pickup row
     */
    validatePickupRow(row) {
        const issues = [];

        if (!row.pickup_doc_number && !row.shipment_number) {
            issues.push('Missing document/shipment number');
        }
        if (!row.execution_date && !row.shipment_created_date) {
            issues.push('Missing date');
        }

        return { isValid: issues.length === 0, issues };
    }

    // ==========================================
    // FILE PROCESSING
    // ==========================================

    /**
     * Main method: parses Excel file with auto-detection
     */
    async parseFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet);

                    if (jsonData.length === 0) {
                        resolve({
                            fileType: FILE_TYPES.UNKNOWN,
                            records: [],
                            errors: [{ message: 'Empty file' }],
                            warnings: [],
                            stats: { total: 0, processed: 0, errorsCount: 1, warningsCount: 0 }
                        });
                        return;
                    }

                    // Detect file type from headers
                    const headers = Object.keys(jsonData[0]);
                    const fileType = this.detectFileType(headers);

                    if (fileType === FILE_TYPES.UNKNOWN) {
                        resolve({
                            fileType: FILE_TYPES.UNKNOWN,
                            records: [],
                            errors: [{ message: 'Unknown file format. Cannot detect if Delivery or Pickup.' }],
                            warnings: [],
                            stats: { total: jsonData.length, processed: 0, errorsCount: 1, warningsCount: 0 }
                        });
                        return;
                    }

                    const result = this.processData(jsonData, fileType);
                    result.filename = file.name;
                    resolve(result);

                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('Error reading file'));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Processes JSON data based on detected file type
     */
    processData(jsonData, fileType) {
        const records = [];
        const errors = [];
        const warnings = [];

        // Filter out total/summary rows
        const filteredData = jsonData.filter(row => {
            const rowNum = row['№'];
            return rowNum !== 'ВСЬОГО' && rowNum !== 'Total' && rowNum !== 'Разом';
        });

        filteredData.forEach((row, index) => {
            try {
                let parsed, validation;

                if (fileType === FILE_TYPES.DELIVERY) {
                    parsed = this.parseDeliveryRow(row);
                    validation = this.validateDeliveryRow(parsed);
                } else {
                    parsed = this.parsePickupRow(row);
                    validation = this.validatePickupRow(parsed);
                }

                if (!validation.isValid) {
                    validation.issues.forEach(issue => {
                        const entry = { row: index + 2, message: issue };
                        if (issue.includes('exceeds') || issue.includes('Missing date')) {
                            warnings.push(entry);
                        } else {
                            errors.push(entry);
                        }
                    });
                }

                // Add if has key identifier
                const hasKey = fileType === FILE_TYPES.DELIVERY
                    ? (parsed.courier_name && parsed.report_date)
                    : (parsed.pickup_doc_number || parsed.shipment_number);

                if (hasKey) {
                    records.push(parsed);
                }

            } catch (err) {
                errors.push({ row: index + 2, message: err.message });
            }
        });

        // CRITICAL: Aggregate pickup data (raw transactions -> daily summaries)
        // Future Python Backend: This aggregation would be handled server-side in a /pickup-aggregates endpoint
        let finalRecords = records;
        if (fileType === FILE_TYPES.PICKUP) {
            finalRecords = this.aggregatePickupData(records);
            console.log(`Aggregated ${records.length} pickup rows into ${finalRecords.length} daily summaries`);
        }

        return {
            fileType,
            records: finalRecords,
            rawRecords: fileType === FILE_TYPES.PICKUP ? records : undefined,
            errors,
            warnings,
            stats: {
                total: jsonData.length,
                processed: finalRecords.length,
                rawCount: fileType === FILE_TYPES.PICKUP ? records.length : undefined,
                errorsCount: errors.length,
                warningsCount: warnings.length
            }
        };
    }

    // ==========================================
    // PICKUP DATA AGGREGATION
    // ==========================================

    /**
     * Aggregates raw pickup transaction data into daily summaries by courier
     *
     * Input: Raw pickup rows (one per shipment)
     * Output: Aggregated rows (one per courier per day)
     *
     * Metrics calculated:
     * - Total pickups count
     * - Total weight (sum of actual_weight)
     * - Success count (where pickup_status indicates completion)
     * - Success rate (percentage)
     *
     * Future Python Backend: Replace this with API call to /pickup-aggregates
     * The backend would use SQL GROUP BY for better performance:
     * SELECT
     *   courier_name,
     *   execution_date,
     *   COUNT(*) as total_pickups,
     *   SUM(actual_weight) as total_weight,
     *   COUNT(CASE WHEN pickup_status IN ('Done', 'Закрито', 'Виконано') THEN 1 END) as success_count
     * FROM pickup_orders
     * GROUP BY courier_name, execution_date
     */
    aggregatePickupData(rawRecords) {
        // Group by courier name and date
        const groups = {};

        rawRecords.forEach(record => {
            const courier = record.courier_name || 'Unknown';
            const date = record.execution_date || record.shipment_created_date || 'Unknown';

            // Create composite key
            const key = `${courier}|${date}`;

            if (!groups[key]) {
                groups[key] = {
                    courier_name: courier,
                    execution_date: date,
                    pickups: [],
                    total_pickups: 0,
                    total_weight: 0,
                    total_pieces: 0,
                    success_count: 0,
                    total_cost: 0
                };
            }

            // Add to group
            groups[key].pickups.push(record);
            groups[key].total_pickups++;
            groups[key].total_weight += record.actual_weight || 0;
            groups[key].total_pieces += record.places_count || 0;
            groups[key].total_cost += record.delivery_cost || 0;

            // Check if pickup was successful
            // Success statuses: "Done", "Закрито", "Виконано", "Closed", "Completed"
            const status = (record.pickup_status || '').toLowerCase();
            const isSuccess = status.includes('done') ||
                            status.includes('закрито') ||
                            status.includes('виконано') ||
                            status.includes('closed') ||
                            status.includes('completed');

            if (isSuccess) {
                groups[key].success_count++;
            }
        });

        // Convert groups to array and calculate rates
        const aggregated = Object.values(groups).map(group => {
            const successRate = group.total_pickups > 0
                ? (group.success_count / group.total_pickups * 100)
                : 0;

            return {
                courier_name: group.courier_name,
                execution_date: group.execution_date,
                total_pickups: group.total_pickups,
                total_weight: group.total_weight,
                total_pieces: group.total_pieces,
                success_count: group.success_count,
                success_rate: successRate,
                total_cost: group.total_cost,
                avg_cost_per_pickup: group.total_pickups > 0 ? group.total_cost / group.total_pickups : 0,
                avg_weight_per_pickup: group.total_pickups > 0 ? group.total_weight / group.total_pickups : 0,
                // Store raw records for drill-down (optional)
                _rawRecords: group.pickups
            };
        });

        return aggregated;
    }

    // ==========================================
    // UTILITY METHODS
    // ==========================================

    /**
     * Groups records by date field
     */
    groupByDate(records, dateField = 'report_date') {
        const groups = {};
        records.forEach(record => {
            const date = record[dateField];
            if (date) {
                if (!groups[date]) groups[date] = [];
                groups[date].push(record);
            }
        });
        return groups;
    }

    /**
     * Groups records by courier
     */
    groupByCourier(records) {
        const groups = {};
        records.forEach(record => {
            const name = record.courier_name;
            if (name) {
                if (!groups[name]) groups[name] = [];
                groups[name].push(record);
            }
        });
        return groups;
    }

    /**
     * Groups pickup records by country
     */
    groupByCountry(records, field = 'sender_country') {
        const groups = {};
        records.forEach(record => {
            const country = record[field] || 'Unknown';
            if (!groups[country]) groups[country] = [];
            groups[country].push(record);
        });
        return groups;
    }

    /**
     * Gets last detected file type
     */
    getLastDetectedType() {
        return this.lastDetectedType;
    }
}

// Export singleton instance
const excelParser = new ExcelParserService();
export default excelParser;

// Also export class for testing
export { ExcelParserService };
