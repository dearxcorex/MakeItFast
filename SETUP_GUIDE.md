# 📋 Date Inspection Feature Setup Guide

## 🎯 Overview
This guide will help you add the `date_inspected` column to your Supabase database and import inspection dates from the Excel file.

## ⚡ Quick Setup (2 steps)

### Step 1: Add Database Column
**Visit Supabase SQL Editor**: https://supabase.com/dashboard/project/iigbezvfqsfuuucvmopt/sql

**Execute this SQL**:
```sql
ALTER TABLE fm_station ADD COLUMN date_inspected DATE;
```

### Step 2: Import Data
**Run the import script**:
```bash
node scripts/directDbUpdate.js
```

## 📊 What the Script Does

### Data Processing
- Reads `data/_Oper_ISO_11_FF11ChkSch_Export.xlsx`
- Extracts station IDs from "รหัสสถานี" column
- Extracts inspection dates from "วันที่ตรวจสอบ" column
- Converts Thai Buddhist Era dates (e.g., "06/01/2568") to Gregorian format (e.g., "2025-01-06")

### Database Updates
- Matches Excel station IDs with `id_fm` in the database
- Updates the `date_inspected` field for matching stations
- Provides detailed progress feedback

### Expected Results
- **164 total records** in Excel file
- Updates stations with matching IDs
- Reports success/error counts
- Logs each update for verification

## 🎨 UI Features

Once data is imported, the map will show:
- **📅 Inspection dates** in station popups
- **🗓️ Formatted dates** in Thai locale
- **📍 Enhanced station information** with inspection history

## 🔍 Verification

After import, you can verify the data by:
1. Opening the app: `npm run dev`
2. Clicking on any station marker
3. Checking for "Inspected: [date]" in the popup

## 🛠️ Alternative: Manual Column Addition

If SQL Editor doesn't work, use the Table Editor:

1. **Visit**: https://supabase.com/dashboard/project/iigbezvfqsfuuucvmopt/editor
2. **Click**: "fm_station" table
3. **Click**: "+ Add Column" button
4. **Configure**:
   - Name: `date_inspected`
   - Type: `date`
   - Nullable: ✅ (checked)
5. **Save** the column

## 📁 Generated Files

- `scripts/directDbUpdate.js` - Main import script
- `scripts/addColumnDirectly.js` - Column addition attempts
- `scripts/examineExcel.js` - Excel structure analysis
- `scripts/add_date_inspected_column.sql` - SQL for manual execution

All scripts are ready to use once the database column is added!