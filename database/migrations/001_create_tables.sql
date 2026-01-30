-- =====================================================
-- Migration 001: Create tables for Delivery Analytics
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Table for Delivery Reports (courier performance)
CREATE TABLE IF NOT EXISTS courier_performance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Original columns from Excel
    report_date DATE NOT NULL,
    courier_name VARCHAR(255) NOT NULL,
    car_number VARCHAR(50),
    department VARCHAR(255),
    reports_count INTEGER DEFAULT 0,
    addresses_count INTEGER DEFAULT 0,
    loaded_parcels INTEGER DEFAULT 0,
    delivered_parcels INTEGER DEFAULT 0,
    delivered_in_hand INTEGER DEFAULT 0,
    delivered_safe_place INTEGER DEFAULT 0,
    undelivered_parcels INTEGER DEFAULT 0,
    undelivered_with_reason INTEGER DEFAULT 0,
    undelivered_no_reason INTEGER DEFAULT 0,
    delivery_success_rate DECIMAL(5,2) DEFAULT 0,

    -- Metadata
    import_batch_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table for Pickup Orders
CREATE TABLE IF NOT EXISTS pickup_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Document info
    pickup_doc_number VARCHAR(100),
    shipments_in_doc INTEGER DEFAULT 1,
    execution_date DATE,
    time_interval VARCHAR(100),
    creation_source VARCHAR(100),
    first_warehouse VARCHAR(255),

    -- Shipment info
    shipment_number VARCHAR(100),
    places_count INTEGER DEFAULT 1,
    shipment_created_date DATE,
    shipment_department VARCHAR(255),
    first_scan_date DATE,
    first_scan_warehouse VARCHAR(255),
    planned_delivery_date DATE,

    -- Sender info
    sender_country VARCHAR(100),
    sender_type VARCHAR(100),
    sender_company VARCHAR(255),
    sender_city VARCHAR(255),
    sender_address TEXT,

    -- Shipment details
    shipment_type VARCHAR(100),
    shipment_description TEXT,
    declared_value DECIMAL(12,2),
    actual_weight DECIMAL(10,3),
    volumetric_weight DECIMAL(10,3),
    dimensions VARCHAR(100),

    -- Recipient info
    recipient_country VARCHAR(100),
    recipient_type VARCHAR(100),

    -- Status info
    pickup_status VARCHAR(100),
    pickup_status_date DATE,
    courier_name VARCHAR(255),

    -- Partner info
    partner_pickup_number VARCHAR(100),
    partner_shipment_number VARCHAR(100),

    -- Payment info
    delivery_cost DECIMAL(12,2),
    delivery_currency VARCHAR(10) DEFAULT 'UAH',
    payer VARCHAR(100),
    payment_doc_number VARCHAR(100),
    payment_doc_status VARCHAR(100),
    payment_doc_status_date DATE,
    shipment_payment_status VARCHAR(100),
    shipment_payment_date DATE,

    -- Final status
    shipment_status VARCHAR(100),
    shipment_status_date DATE,
    verification_result VARCHAR(255),
    acceptance_date DATE,
    last_scan_date DATE,
    last_scan_department VARCHAR(255),
    last_scan_report VARCHAR(255),

    -- Performance
    execution_speed VARCHAR(100),
    non_execution_reason TEXT,

    -- Metadata
    import_batch_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table for Import Logs
CREATE TABLE IF NOT EXISTS import_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('delivery', 'pickup')),
    records_count INTEGER DEFAULT 0,
    records_imported INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    errors JSONB DEFAULT '[]'::jsonb,
    imported_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- =====================================================
-- Indexes for better query performance
-- =====================================================

-- Courier performance indexes
CREATE INDEX IF NOT EXISTS idx_courier_performance_date ON courier_performance(report_date);
CREATE INDEX IF NOT EXISTS idx_courier_performance_courier ON courier_performance(courier_name);
CREATE INDEX IF NOT EXISTS idx_courier_performance_department ON courier_performance(department);
CREATE INDEX IF NOT EXISTS idx_courier_performance_batch ON courier_performance(import_batch_id);

-- Pickup orders indexes
CREATE INDEX IF NOT EXISTS idx_pickup_orders_execution_date ON pickup_orders(execution_date);
CREATE INDEX IF NOT EXISTS idx_pickup_orders_courier ON pickup_orders(courier_name);
CREATE INDEX IF NOT EXISTS idx_pickup_orders_sender_country ON pickup_orders(sender_country);
CREATE INDEX IF NOT EXISTS idx_pickup_orders_recipient_country ON pickup_orders(recipient_country);
CREATE INDEX IF NOT EXISTS idx_pickup_orders_status ON pickup_orders(shipment_status);
CREATE INDEX IF NOT EXISTS idx_pickup_orders_batch ON pickup_orders(import_batch_id);

-- Import logs indexes
CREATE INDEX IF NOT EXISTS idx_import_logs_type ON import_logs(file_type);
CREATE INDEX IF NOT EXISTS idx_import_logs_status ON import_logs(status);

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

ALTER TABLE courier_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for anon users (adjust for production)
CREATE POLICY "Allow public access to courier_performance" ON courier_performance
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public access to pickup_orders" ON pickup_orders
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public access to import_logs" ON import_logs
    FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- Trigger for updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_courier_performance_updated_at
    BEFORE UPDATE ON courier_performance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pickup_orders_updated_at
    BEFORE UPDATE ON pickup_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
