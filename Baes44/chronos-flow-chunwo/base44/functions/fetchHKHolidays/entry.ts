import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Parse Chinese date strings like "1月1日", "2月17日" into yyyy-mm-dd given a year
function parseChineseDate(str, year) {
  const m = str.match(/(\d+)月(\d+)日/);
  if (!m) return null;
  const month = String(m[1]).padStart(2, "0");
  const day   = String(m[2]).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Fetch and parse one year's page from labour.gov.hk
async function fetchYearHolidays(year) {
  const url = `https://www.labour.gov.hk/tc/news/latest_holidays${year}.htm`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const html = await res.text();
  const dates = [];

  // Extract all Chinese date patterns from table cells
  // Pattern: >\s*(\d+月\d+日)\s*< 
  const cellRe = />\s*(\d+月\d+日(?:\s*或\s*\d+月\d+日)?)\s*</g;
  let match;
  while ((match = cellRe.exec(html)) !== null) {
    const raw = match[1].trim();
    // Handle "X月X日 或 Y月Y日" — pick the first date (employer may choose; use first)
    const parts = raw.split(/\s*或\s*/);
    for (const part of parts) {
      const d = parseChineseDate(part.trim(), year);
      if (d && !dates.includes(d)) dates.push(d);
    }
  }

  return dates;
}

Deno.serve(async (req) => {
  try {
    // Fetch holidays from 2017 to 2028 (Labour Dept has pages for 2017-2027)
    const years = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027];

    const results = await Promise.all(years.map(async (yr) => {
      const dates = await fetchYearHolidays(yr);
      return { year: yr, dates };
    }));

    // Flatten into a single sorted array
    const allDates = [...new Set(results.flatMap(r => r.dates))].sort();

    return Response.json({ 
      holidays: allDates,
      fetched_at: new Date().toISOString(),
      years: results.map(r => ({ year: r.year, count: r.dates.length }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});