-- Data Accumulation System Migration
-- Run this in your Supabase SQL Editor

-- Enhance imports table with more tracking fields
ALTER TABLE imports ADD COLUMN IF NOT EXISTS import_mode VARCHAR(20) DEFAULT 'append';
ALTER TABLE imports ADD COLUMN IF NOT EXISTS duplicates_found INTEGER DEFAULT 0;
ALTER TABLE imports ADD COLUMN IF NOT EXISTS duplicates_skipped INTEGER DEFAULT 0;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_imports_date ON imports(imported_at DESC);

-- Function to check for duplicate deliveries
CREATE OR REPLACE FUNCTION check_delivery_duplicate(
    p_courier_id UUID,
    p_delivery_date DATE,
    p_zone_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM deliveries
        WHERE courier_id = p_courier_id
        AND delivery_date = p_delivery_date
        AND zone_id = p_zone_id
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get import statistics
CREATE OR REPLACE FUNCTION get_import_history(
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    file_name TEXT,
    records_count INTEGER,
    import_mode TEXT,
    duplicates_found INTEGER,
    duplicates_skipped INTEGER,
    status TEXT,
    imported_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.file_name,
        i.records_count,
        i.import_mode,
        i.duplicates_found,
        i.duplicates_skipped,
        i.status,
        i.imported_at
    FROM imports i
    ORDER BY i.imported_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
