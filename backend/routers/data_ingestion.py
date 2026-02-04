from datetime import date, datetime, time
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from backend.models import ShipmentImport, DeliveryEventImport, ImportResult
from backend.supabase_client import supabase
import pandas as pd
import io
import math

router = APIRouter(prefix="/api/ingest", tags=["Data Ingestion V2"])

# ==========================================
# Helpers for Cleaning
# ==========================================

def parse_float(value) -> float:
    """Parse string with comma decimals to float"""
    if pd.isna(value) or value == "":
        return 0.0
    if isinstance(value, float) or isinstance(value, int):
        return float(value)
    
    clean_str = str(value).replace(',', '.').replace(' EUR', '').replace('%', '').strip()
    try:
        return float(clean_str)
    except ValueError:
        return 0.0

def parse_date(value, fmt="%d.%m.%Y") -> Optional[date]:
    """Parse date with specific format"""
    if pd.isna(value) or value == "":
        return None
    
    # If already datetime
    if isinstance(value, (datetime, date)):
        return value.date() if isinstance(value, datetime) else value
        
    try:
        # Try primary format
        return datetime.strptime(str(value).strip(), fmt).date()
    except ValueError:
        # Try flexible fallback
        try:
            return pd.to_datetime(value).date()
        except:
            return None

def parse_time(value) -> Optional[time]:
    if pd.isna(value) or value == "":
        return None
    try:
        val_str = str(value).strip()
        # Handle "10:24" format
        if len(val_str) == 5:
            return datetime.strptime(val_str, "%H:%M").time()
        return None
    except:
        return None

# ==========================================
# Source A: Shipments
# ==========================================

@router.post("/shipments", response_model=ImportResult)
async def import_shipments(
    file: UploadFile = File(...),
):
    """
    Import Source A: Pickup Indicators (Shipments Base Data)
    """
    try:
        content = await file.read()
        # Try reading excel, if fail try csv
        try:
            df = pd.read_excel(io.BytesIO(content))
        except:
            # Fallback for CSV with potential encoding issues
            try:
                df = pd.read_csv(io.BytesIO(content), encoding='utf-8')
            except:
                df = pd.read_csv(io.BytesIO(content), encoding='cp1251') # Common Cyrillic encoding fallback

        records = []
        errors = []
        skipped = 0

        # Mapping Config (Source Column -> Target Field)
        # Based on User Spec
        
        for index, row in df.iterrows():
            try:
                # Key
                shipment_num = str(row.get('Номер Shipment', '')).strip()
                if not shipment_num or shipment_num == 'nan':
                    skipped += 1
                    continue

                shipping_import = ShipmentImport(
                    shipment_number=shipment_num,
                    pickup_doc_number=str(row.get('Номер документу PickUp', '')),
                    pickup_shipment_count=int(parse_float(row.get('Кількість шипментів у документі PickUp'))),
                    pickup_execution_date=parse_date(row.get('Дата виконання документу PickUp'), "%d.%m.%Y"),
                    pickup_time_slot=str(row.get('Замовлений часовий інтервал', '')),
                    
                    sender_country=str(row.get('Країна відправника', '')),
                    sender_type=str(row.get('Тип відправника', '')),
                    sender_company=str(row.get('Компанія відправник', '')),
                    sender_city=str(row.get('Місто відправника', '')),
                    
                    shipment_type=str(row.get('Тип відправлення', '')),
                    declared_value=parse_float(row.get('Оголошена вартість відправлення')),
                    total_weight_actual=parse_float(row.get('Загальна фактична вага відправлення')),
                    total_weight_volumetric=parse_float(row.get("Загальна об'ємна вага відправлення")),
                    dimensions=str(row.get('Довжина, см*Ширина, см*Висота, см', '')),
                    places_count=int(parse_float(row.get('Кількість мість'))),
                    
                    receiver_country=str(row.get('Країна отримувача', '')),
                    receiver_type=str(row.get('Тип отримувача', '')),
                    
                    delivery_cost=parse_float(row.get('Вартість доставки')),
                    payer_type=str(row.get('Платник', '')),
                    payment_status=str(row.get('Статус оплати Shipment', '')),
                    
                    last_shipment_status=str(row.get('Останній статус Shipment', '')),
                    last_shipment_status_date=parse_date(row.get('Дата останнього статусу Shipment'), "%d.%m.%Y"),
                    execution_speed=str(row.get('Швидкість виконання', ''))
                )
                records.append(shipping_import.dict())

            except Exception as e:
                errors.append(f"Row {index + 2}: {str(e)}")
                skipped += 1

        # Bulk upsert to Supabase
        if records:
            BATCH_SIZE = 500
            for i in range(0, len(records), BATCH_SIZE):
                batch = records[i : i + BATCH_SIZE]
                # Upsert to 'shipments'
                await supabase.upsert_data("shipments", batch)

        return ImportResult(
            success=len(errors) == 0,
            total_records=len(df),
            imported_records=len(records),
            skipped_records=skipped,
            errors=errors[:10]
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# Source B: Delivery Events
# ==========================================

@router.post("/events", response_model=ImportResult)
async def import_events(
    file: UploadFile = File(...),
):
    """
    Import Source B: Detailed Delivery Data (Operational Events)
    """
    try:
        content = await file.read()
        try:
            df = pd.read_excel(io.BytesIO(content))
        except:
             try:
                df = pd.read_csv(io.BytesIO(content), encoding='utf-8')
             except:
                df = pd.read_csv(io.BytesIO(content), encoding='cp1251')

        records = []
        errors = []
        skipped = 0
        
        for index, row in df.iterrows():
            try:
                shipment_num = str(row.get('Номер Shipment', '')).strip()
                if not shipment_num or shipment_num == 'nan':
                    # Can't link event without shipment number
                    skipped += 1
                    continue

                event_import = DeliveryEventImport(
                    shipment_number=shipment_num,
                    report_date=parse_date(row.get('Дата відомості'), "%d-%m-%Y"), # Specific format from spec
                    
                    courier_name=str(row.get("ПІБ кур'єра", '')),
                    car_number=str(row.get('Номер авто', '')),
                    loading_sheet_number=str(row.get("Номер відомості завантаження кур'єра", '')),
                    branch=str(row.get('Підрозділ відомості', '')),
                    
                    shipment_created_date=parse_date(row.get('Дата створення Shipment'), "%d-%m-%Y"),
                    last_warehouse=str(row.get('Останній логістичний склад Shipment', '')),
                    planned_arrival_date=parse_date(row.get('Планова дата надходження (Plan Date)', '')), # Fallback parser
                    
                    receiver_city=str(row.get('Місто одержувача', '')),
                    receiver_address=str(row.get('Адреса одержувача', '')),
                    district=str(row.get('Район (статичний/динамічний)', '')),
                    
                    status_on_date=str(row.get('Статус Shipment на дату відомості', '')),
                    delivery_status_on_date=str(row.get('Статус доставки на дату відомості', '')),
                    delivery_date=parse_date(row.get('Дата доставки на дату відомості'), "%d-%m-%Y"),
                    delivery_time=parse_time(row.get('Час доставки на дату відомості')),
                    
                    predict_window=str(row.get('Розрахунковий час доставки (Predict)', '')),
                    failure_reason=str(row.get('Причина недоставки на дату відомості/деталізація', '')),
                    delivery_type=str(row.get('Тип доставки', '')),
                    
                    is_duplicate=(str(row.get('Дублікат', '')).lower() == 'так')
                )
                records.append(event_import.dict())

            except Exception as e:
                errors.append(f"Row {index + 2}: {str(e)}")
                skipped += 1

        # Bulk upsert using custom logic or raw inserts
        # Since events are linked, we might want to ignore those where shipment doesn't exist
        # Or better: ensure shipments exist first.
        # For now, we assume user uploads Source A first, OR we allow orphaned events (but FK constraint might fail).
        
        valid_records = []
        if records:
            # Pre-check existence if needed, or rely on db error
            # For bulk speed, we'll try to insert and catch errors? 
            # Ideally, we should use ON CONFLICT DO NOTHING or ignore.
            
            BATCH_SIZE = 500
            for i in range(0, len(records), BATCH_SIZE):
                batch = records[i : i + BATCH_SIZE]
                try:
                    await supabase.insert_data("delivery_events", batch)
                except Exception as batch_err:
                     errors.append(f"Batch insert error: {str(batch_err)}")

        return ImportResult(
            success=len(errors) == 0,
            total_records=len(df),
            imported_records=len(records), # Count of parsed, not necessarily DB inserted if batch failed
            skipped_records=skipped,
            errors=errors[:10]
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
