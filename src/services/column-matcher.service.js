// =============================================
// Column Matcher Service
// Fuzzy matching for Excel column headers
// =============================================

class ColumnMatcherService {

    constructor() {
        // Define keyword patterns for each database field
        this.deliveryPatterns = {
            report_date: ['дата', 'date', 'відомості', 'звіт'],
            courier_name: ['кур\'єр', 'курєр', 'courier', 'піб', 'імя', 'name', 'прізвище'],
            car_number: ['авто', 'номер авто', 'машина', 'vehicle', 'car'],
            department: ['підрозділ', 'department', 'відділ', 'відомості'],
            loaded_parcels: ['завантажен', 'loaded', 'шк', 'к-сть завантажених'],
            delivered_parcels: ['доставлен', 'delivered', 'к-сть доставлених'],
            delivery_success_rate: ['відсоток', 'success', 'процент', '%']
        };

        this.pickupPatterns = {
            pickup_doc_number: ['номер документу', 'pickup', 'документ'],
            courier_name: ['кур\'єр', 'курєр', 'courier', 'прізвище', 'імя'],
            execution_date: ['дата виконання', 'execution', 'виконання'],
            shipment_number: ['shipment', 'шипмент', 'номер shipment'],
            sender_country: ['країна відправника', 'sender country', 'відправник'],
            recipient_country: ['країна отримувача', 'recipient country', 'отримувач'],
            actual_weight: ['фактична вага', 'actual weight', 'вага'],
            delivery_cost: ['вартість', 'cost', 'ціна']
        };
    }

    /**
     * Calculate similarity between two strings using Levenshtein distance
     * Returns a score from 0 (no match) to 1 (perfect match)
     */
    calculateSimilarity(str1, str2) {
        const s1 = str1.toLowerCase().trim();
        const s2 = str2.toLowerCase().trim();

        if (s1 === s2) return 1.0;

        // Quick check: if one string contains the other
        if (s1.includes(s2) || s2.includes(s1)) {
            return 0.8;
        }

        // Levenshtein distance
        const matrix = [];
        const len1 = s1.length;
        const len2 = s2.length;

        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,      // deletion
                    matrix[i][j - 1] + 1,      // insertion
                    matrix[i - 1][j - 1] + cost // substitution
                );
            }
        }

        const distance = matrix[len1][len2];
        const maxLen = Math.max(len1, len2);
        return 1 - (distance / maxLen);
    }

    /**
     * Find best matching database field for a given Excel column header
     * @param {string} header - Excel column header
     * @param {string} fileType - 'delivery' or 'pickup'
     * @returns {object} - { field: string, confidence: number }
     */
    findBestMatch(header, fileType = 'delivery') {
        const patterns = fileType === 'delivery' ? this.deliveryPatterns : this.pickupPatterns;
        const headerLower = header.toLowerCase().trim();

        let bestMatch = null;
        let bestScore = 0;

        for (const [field, keywords] of Object.entries(patterns)) {
            for (const keyword of keywords) {
                // Check if header contains the keyword
                if (headerLower.includes(keyword.toLowerCase())) {
                    const score = 0.9; // High confidence for keyword match
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = field;
                    }
                }

                // Calculate similarity score
                const similarity = this.calculateSimilarity(headerLower, keyword);
                if (similarity > bestScore && similarity > 0.6) { // Threshold: 60%
                    bestScore = similarity;
                    bestMatch = field;
                }
            }
        }

        return {
            field: bestMatch,
            confidence: bestScore,
            originalHeader: header
        };
    }

    /**
     * Map all Excel headers to database fields
     * @param {string[]} headers - Array of Excel column headers
     * @param {string} fileType - 'delivery' or 'pickup'
     * @returns {object} - { columnMap: {}, unmapped: [], confidence: number }
     */
    mapHeaders(headers, fileType = 'delivery') {
        const columnMap = {};
        const unmapped = [];
        const matches = [];

        headers.forEach(header => {
            const match = this.findBestMatch(header, fileType);

            if (match.field && match.confidence > 0.6) {
                columnMap[header] = match.field;
                matches.push(match);
            } else {
                unmapped.push(header);
            }
        });

        // Calculate overall confidence
        const avgConfidence = matches.length > 0
            ? matches.reduce((sum, m) => sum + m.confidence, 0) / matches.length
            : 0;

        return {
            columnMap,
            unmapped,
            confidence: avgConfidence,
            matches
        };
    }

    /**
     * Validate if the mapping is good enough to proceed
     * @param {object} mappingResult - Result from mapHeaders()
     * @param {string} fileType - 'delivery' or 'pickup'
     * @returns {object} - { isValid: boolean, missingFields: [], message: string }
     */
    validateMapping(mappingResult, fileType = 'delivery') {
        const requiredFields = fileType === 'delivery'
            ? ['courier_name', 'report_date', 'loaded_parcels', 'delivered_parcels']
            : ['courier_name', 'execution_date'];

        const mappedFields = Object.values(mappingResult.columnMap);
        const missingFields = requiredFields.filter(field => !mappedFields.includes(field));

        const isValid = missingFields.length === 0 && mappingResult.confidence > 0.7;

        let message = '';
        if (!isValid) {
            if (missingFields.length > 0) {
                message = `Missing required fields: ${missingFields.join(', ')}`;
            } else {
                message = `Low confidence mapping (${(mappingResult.confidence * 100).toFixed(0)}%)`;
            }
        } else {
            message = `Mapping successful (${(mappingResult.confidence * 100).toFixed(0)}% confidence)`;
        }

        return {
            isValid,
            missingFields,
            message,
            confidence: mappingResult.confidence
        };
    }

    /**
     * Get suggested column name for a database field
     * @param {string} field - Database field name
     * @param {string} fileType - 'delivery' or 'pickup'
     * @returns {string} - Suggested Excel column name
     */
    getSuggestedColumnName(field, fileType = 'delivery') {
        const patterns = fileType === 'delivery' ? this.deliveryPatterns : this.pickupPatterns;
        const keywords = patterns[field];
        return keywords ? keywords[0] : field;
    }
}

// Export singleton instance
const columnMatcher = new ColumnMatcherService();
export default columnMatcher;

// Also export class for testing
export { ColumnMatcherService };
