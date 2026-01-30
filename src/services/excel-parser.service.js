// =============================================
// Excel Parser Service
// =============================================

class ExcelParserService {
    
    /**
     * Парсить дату з різних форматів
     */
    parseDate(rawDate) {
        if (!rawDate) return null;
        
        // Excel serial number
        if (typeof rawDate === 'number') {
            return new Date(Math.round((rawDate - 25569) * 86400 * 1000));
        }
        
        // String formats
        if (typeof rawDate === 'string') {
            const cleanStr = rawDate.trim();
            
            // European format: DD.MM.YYYY or DD-MM-YYYY
            const europeanPattern = /^(\d{1,2})[-.](\d{1,2})[-.](\d{4})/;
            const match = cleanStr.match(europeanPattern);
            if (match) {
                const day = parseInt(match[1], 10);
                const month = parseInt(match[2], 10) - 1;
                const year = parseInt(match[3], 10);
                return new Date(year, month, day);
            }
            
            // ISO or standard format
            const standardDate = new Date(cleanStr);
            if (!isNaN(standardDate)) return standardDate;
        }
        
        return null;
    }

    /**
     * Форматує дату в ISO string (YYYY-MM-DD)
     */
    formatDateISO(date) {
        if (!date) return null;
        const d = new Date(date);
        return d.toISOString().split('T')[0];
    }

    /**
     * Конвертує рядок Excel в об'єкт доставки
     */
    parseRow(row) {
        const dateObj = this.parseDate(row['Дата відомості']);
        
        if (!dateObj) {
            return null; // Пропускаємо рядки без дати
        }

        return {
            deliveryDate: this.formatDateISO(dateObj),
            courierName: row["ПІБ кур'єра"]?.trim() || null,
            vehicleNumber: row['Номер авто']?.trim() || null,
            zoneName: row['Підрозділ відомості']?.trim() || null,
            loadedCount: parseInt(row['К-сть завантажених ШК']) || 0,
            deliveredCount: parseInt(row['К-сть доставлених ШК на дату відомості']) || 0,
            
            // Оригінальні дані для відладки
            _raw: row,
            _dateObj: dateObj
        };
    }

    /**
     * Валідує рядок даних
     */
    validateRow(row) {
        const issues = [];

        if (!row.courierName) {
            issues.push('Відсутнє ПІБ курʼєра');
        }

        if (!row.deliveryDate) {
            issues.push('Невалідна дата');
        }

        if (row.loadedCount < 0) {
            issues.push('Негативна кількість завантажених');
        }

        if (row.deliveredCount < 0) {
            issues.push('Негативна кількість доставлених');
        }

        if (row.deliveredCount > row.loadedCount) {
            issues.push('Доставлено більше ніж завантажено');
        }

        return {
            isValid: issues.length === 0,
            issues
        };
    }

    /**
     * Парсить Excel файл
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
                    
                    const result = this.processData(jsonData);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Помилка читання файлу'));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Обробляє JSON дані з Excel
     */
    processData(jsonData) {
        const records = [];
        const errors = [];
        const warnings = [];

        // Фільтруємо службові рядки
        const filteredData = jsonData.filter(row => {
            const isTotalRow = row['№'] === 'ВСЬОГО' || row['№'] === 'Total';
            const hasLoad = row['К-сть завантажених ШК'] !== undefined;
            return !isTotalRow && hasLoad;
        });

        filteredData.forEach((row, index) => {
            const parsed = this.parseRow(row);
            
            if (!parsed) {
                errors.push({
                    row: index + 2, // +2 для Excel (header + 1-based)
                    message: 'Невалідна дата',
                    data: row
                });
                return;
            }

            const validation = this.validateRow(parsed);
            
            if (!validation.isValid) {
                validation.issues.forEach(issue => {
                    if (issue.includes('більше ніж завантажено')) {
                        warnings.push({
                            row: index + 2,
                            message: issue,
                            data: parsed
                        });
                    } else {
                        errors.push({
                            row: index + 2,
                            message: issue,
                            data: parsed
                        });
                    }
                });
            }

            // Додаємо навіть з warnings
            if (parsed.courierName && parsed.deliveryDate) {
                records.push(parsed);
            }
        });

        // Шукаємо дублікати
        const duplicates = this.findDuplicates(records);
        if (duplicates.length > 0) {
            warnings.push({
                message: `Знайдено ${duplicates.length} можливих дублікатів`,
                data: duplicates
            });
        }

        return {
            records,
            errors,
            warnings,
            stats: {
                total: jsonData.length,
                processed: records.length,
                errorsCount: errors.length,
                warningsCount: warnings.length
            }
        };
    }

    /**
     * Шукає дублікати
     */
    findDuplicates(records) {
        const seen = new Map();
        const duplicates = [];

        records.forEach(record => {
            const key = `${record.deliveryDate}_${record.courierName}_${record.zoneName}`;
            
            if (seen.has(key)) {
                duplicates.push({
                    original: seen.get(key),
                    duplicate: record
                });
            } else {
                seen.set(key, record);
            }
        });

        return duplicates;
    }

    /**
     * Групує записи по датах
     */
    groupByDate(records) {
        const groups = {};
        
        records.forEach(record => {
            if (!groups[record.deliveryDate]) {
                groups[record.deliveryDate] = [];
            }
            groups[record.deliveryDate].push(record);
        });

        return groups;
    }

    /**
     * Групує записи по курʼєрах
     */
    groupByCourier(records) {
        const groups = {};
        
        records.forEach(record => {
            if (!groups[record.courierName]) {
                groups[record.courierName] = [];
            }
            groups[record.courierName].push(record);
        });

        return groups;
    }
}

// Експортуємо singleton
const excelParser = new ExcelParserService();
export default excelParser;
