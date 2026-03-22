/**
 * Import interference sites from KML file into the database.
 * Filters by specified provinces (CHANGWAT).
 *
 * Usage: node scripts/importKmlInterference.js [path-to-kml] [province1,province2,...]
 * Example: node scripts/importKmlInterference.js /path/to/Lot1_Site.kml "นครราชสีมา,ชัยภูมิ,บุรีรัมย์"
 */

require('dotenv').config();
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function extractSimpleData(placemark) {
  const data = {};
  const regex = /<SimpleData name="([^"]+)">([^<]*)<\/SimpleData>/g;
  let match;
  while ((match = regex.exec(placemark)) !== null) {
    data[match[1]] = match[2];
  }
  return data;
}

function extractCoordinates(placemark) {
  const match = placemark.match(/<coordinates>([^<]+)<\/coordinates>/);
  if (!match) return { lon: null, lat: null };
  const [lon, lat] = match[1].trim().split(',').map(Number);
  return { lon, lat };
}

function parseFloat_(val) {
  if (!val || val === '') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function str(val) {
  return val && val !== '' ? val : null;
}

function parsePlacemarks(kmlContent) {
  const placemarks = [];
  const regex = /<Placemark>([\s\S]*?)<\/Placemark>/g;
  let match;
  while ((match = regex.exec(kmlContent)) !== null) {
    const raw = match[1];
    const fields = extractSimpleData(raw);
    const coords = extractCoordinates(raw);

    placemarks.push({
      site_code: str(fields['Site']),
      site_name: str(fields['Site name']),
      lat: parseFloat_(fields['Lat']) ?? coords.lat,
      long: parseFloat_(fields['Long']) ?? coords.lon,
      mc_zone: str(fields['MC_ZONE']),
      changwat: str(fields['CHANGWAT']),
      cell_name: str(fields['Cell Name']),
      sector_name: str(fields['Sector name']),
      direction: parseFloat_(fields['Direction']),
      avg_ni_carrier: parseFloat_(fields['Average NI of Carrier']),
      day_time: parseFloat_(fields['Day time']),
      night_time: parseFloat_(fields['Night time']),
      source_lat: parseFloat_(fields['Latitude source']),
      source_long: parseFloat_(fields['Longitude source']),
      estimate_distance: (() => {
        const m = parseFloat_(fields['Estimate Distance (m.)']);
        return m !== null ? m / 1000 : null;
      })(),
      ranking: str(fields['Ranking']),
      status: str(fields['Status']),
      nbtc_area: str(fields['NBTC Area']),
      awn_contact: str(fields['AWN Contact']),
      lot: str(fields['Lot']),
    });
  }
  return placemarks;
}

async function main() {
  const kmlPath = process.argv[2] || '/Users/deardevx/Downloads/Lot1_Site.kml';
  const provincesArg = process.argv[3] || 'นครราชสีมา,ชัยภูมิ,บุรีรัมย์';
  const targetProvinces = provincesArg.split(',').map(p => p.trim());

  console.log(`Reading KML: ${kmlPath}`);
  console.log(`Filter provinces: ${targetProvinces.join(', ')}`);

  if (!fs.existsSync(kmlPath)) {
    console.error(`File not found: ${kmlPath}`);
    process.exit(1);
  }

  const kml = fs.readFileSync(kmlPath, 'utf-8');
  const allPlacemarks = parsePlacemarks(kml);
  console.log(`Total placemarks parsed: ${allPlacemarks.length}`);

  const filtered = allPlacemarks.filter(p => targetProvinces.includes(p.changwat));
  console.log(`Sites matching provinces: ${filtered.length}`);

  if (filtered.length === 0) {
    console.log('No matching sites found. Exiting.');
    await prisma.$disconnect();
    return;
  }

  // Show breakdown
  const byProvince = {};
  filtered.forEach(p => {
    byProvince[p.changwat] = (byProvince[p.changwat] || 0) + 1;
  });
  console.log('Breakdown:', byProvince);

  // Check for existing duplicates by cell_name (unique per sector)
  const existingCellNames = await prisma.interference_site.findMany({
    where: {
      cell_name: { in: filtered.map(f => f.cell_name).filter(Boolean) }
    },
    select: { cell_name: true }
  });
  const existingSet = new Set(existingCellNames.map(r => r.cell_name));

  const toInsert = filtered.filter(f => !existingSet.has(f.cell_name));
  const skipped = filtered.length - toInsert.length;

  if (skipped > 0) {
    console.log(`Skipping ${skipped} sites already in DB (matched by cell_name)`);
  }

  if (toInsert.length === 0) {
    console.log('All sites already exist. Nothing to insert.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Inserting ${toInsert.length} new sites...`);

  const result = await prisma.interference_site.createMany({
    data: toInsert,
    skipDuplicates: true,
  });

  console.log(`Successfully inserted ${result.count} sites.`);

  // Verify
  const verifyCount = await prisma.interference_site.count({
    where: { changwat: { in: targetProvinces } }
  });
  console.log(`Total sites in DB for target provinces: ${verifyCount}`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Error:', err);
  prisma.$disconnect();
  process.exit(1);
});
