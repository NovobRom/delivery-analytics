-- =============================================
-- Schema V2: Data Architecture Overhaul (Source A & B)
-- =============================================

-- 1. SHIPMENTS Table (Source A - Base Indicators)
CREATE TABLE shipments (
    shipment_number VARCHAR(50) PRIMARY KEY, -- Key Identifier
    
    -- Pickup Details
    pickup_doc_number VARCHAR(50),
    pickup_shipment_count INTEGER DEFAULT 0,
    pickup_execution_date DATE,
    pickup_time_slot VARCHAR(50),
    
    -- Sender Details
    sender_country VARCHAR(10),
    sender_type VARCHAR(50),
    sender_company VARCHAR(255),
    sender_city VARCHAR(100),
    
    -- Shipment Specs
    shipment_type VARCHAR(50),
    declared_value DECIMAL(10, 2), -- EUR
    total_weight_actual DECIMAL(10, 3), -- kg
    total_weight_volumetric DECIMAL(10, 3), -- kg
    dimensions VARCHAR(100),
    places_count INTEGER DEFAULT 1,
    
    -- Receiver Details
    receiver_country VARCHAR(10),
    receiver_type VARCHAR(50),
    
    -- Financials & Status
    delivery_cost DECIMAL(10, 2), -- EUR
    payer_type VARCHAR(50),
    payment_status VARCHAR(50),
    
    last_shipment_status VARCHAR(100),
    last_shipment_status_date DATE,
    execution_speed VARCHAR(50),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Shipments
CREATE INDEX idx_shipments_date ON shipments(pickup_execution_date);
CREATE INDEX idx_shipments_status ON shipments(last_shipment_status);
CREATE INDEX idx_shipments_sender_country ON shipments(sender_country);


-- 2. DELIVERY EVENTS Table (Source B - Operational Details)
CREATE TABLE delivery_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Link to Shipment
    shipment_number VARCHAR(50) REFERENCES shipments(shipment_number) ON DELETE CASCADE,
    
    -- Delivery Run Details
    report_date DATE NOT NULL,
    courier_name VARCHAR(255),
    car_number VARCHAR(50),
    loading_sheet_number VARCHAR(100),
    branch VARCHAR(100),
    
    -- Shipment State at Event
    shipment_created_date DATE,
    last_warehouse VARCHAR(100),
    planned_arrival_date DATE,
    
    -- Delivery Specifics
    receiver_city VARCHAR(100),
    receiver_address TEXT, -- Raw address
    district VARCHAR(50),
    
    -- Operations
    status_on_date VARCHAR(100),
    delivery_status_on_date VARCHAR(100), -- "Доставлено", "Не доставлено"
    delivery_date DATE,
    delivery_time TIME,
    predict_window VARCHAR(50),
    failure_reason TEXT,
    delivery_type VARCHAR(50), -- "В руки", "Safe Place"
    
    is_duplicate BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Delivery Events
CREATE INDEX idx_events_report_date ON delivery_events(report_date);
CREATE INDEX idx_events_courier ON delivery_events(courier_name);
CREATE INDEX idx_events_shipment ON delivery_events(shipment_number);
CREATE INDEX idx_events_delivery_status ON delivery_events(delivery_status_on_date);
