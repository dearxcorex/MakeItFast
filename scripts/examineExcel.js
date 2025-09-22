const XLSX = require('xlsx');
const path = require('path');

// Read the Excel file
const filePath = path.join(__dirname, '../data/_Oper_ISO_11_FF11ChkSch_Export.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('Sheet names:', workbook.SheetNames);

// Get the first sheet
const firstSheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[firstSheetName];

// Convert to JSON to examine structure
const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('\nFirst 5 rows:');
jsonData.slice(0, 5).forEach((row, index) => {
  console.log(`Row ${index}:`, row);
});

// Get column headers
console.log('\nColumn headers (Row 0):');
const headers = jsonData[0];
headers.forEach((header, index) => {
  console.log(`Column ${index}: "${header}"`);
});

// Look for specific columns we need
console.log('\nLooking for specific columns:');
const stationIdIndex = headers.findIndex(h => h && h.includes('รหัสสถานี'));
const inspectionDateIndex = headers.findIndex(h => h && h.includes('วันที่ตรวจสอบ'));

console.log(`รหัสสถานี column index: ${stationIdIndex}`);
console.log(`วันที่ตรวจสอบ column index: ${inspectionDateIndex}`);

if (stationIdIndex !== -1 && inspectionDateIndex !== -1) {
  console.log('\nSample data from these columns:');
  jsonData.slice(1, 6).forEach((row, index) => {
    console.log(`Row ${index + 1}:`);
    console.log(`  รหัสสถานี: ${row[stationIdIndex]}`);
    console.log(`  วันที่ตรวจสอบ: ${row[inspectionDateIndex]}`);
  });
}

console.log(`\nTotal rows: ${jsonData.length}`);