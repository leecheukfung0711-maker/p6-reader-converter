/**
 * Hong Kong SAR Statutory Holidays - with auto-update from Labour Dept website.
 * Fallback static list (2024–2026) used when network fetch is unavailable.
 */

// ── Static fallback (Labour Dept statutory holidays, updated as of June 2026) ──
// Source: https://www.labour.gov.hk/tc/news/holidays_list.htm
const STATIC_HOLIDAYS = new Set([
  // 2017 (12 days)
  "2017-01-01","2017-01-02","2017-01-28","2017-01-30","2017-01-31",
  "2017-04-04","2017-05-01","2017-05-30","2017-07-01","2017-10-01","2017-10-02","2017-10-05","2017-10-28",
  "2017-12-22","2017-12-25",
  // 2018 (12 days)
  "2018-01-01","2018-02-16","2018-02-17","2018-02-19",
  "2018-04-05","2018-05-01","2018-06-18","2018-07-01","2018-07-02",
  "2018-09-25","2018-10-01","2018-10-17",
  "2018-12-22","2018-12-25",
  // 2019 (12 days)
  "2019-01-01","2019-02-05","2019-02-06","2019-02-07",
  "2019-04-05","2019-05-01","2019-06-07","2019-07-01",
  "2019-09-14","2019-10-01","2019-10-07",
  "2019-12-22","2019-12-25",
  // 2020 (12 days)
  "2020-01-01","2020-01-25","2020-01-27","2020-01-28",
  "2020-04-04","2020-05-01","2020-06-25","2020-07-01",
  "2020-10-01","2020-10-02","2020-10-25",
  "2020-12-21","2020-12-25",
  // 2021 (12 days)
  "2021-01-01","2021-02-12","2021-02-13","2021-02-15",
  "2021-04-04","2021-05-01","2021-06-14","2021-07-01",
  "2021-09-22","2021-10-01","2021-10-14",
  "2021-12-21","2021-12-25",
  // 2022 (13 days)
  "2022-01-01","2022-02-01","2022-02-02","2022-02-03",
  "2022-04-05","2022-05-01","2022-05-08","2022-06-03",
  "2022-07-01","2022-09-12","2022-10-01","2022-10-04",
  "2022-12-22","2022-12-25",
  // 2023 (13 days)
  "2023-01-01","2023-01-23","2023-01-24","2023-01-25",
  "2023-04-05","2023-05-01","2023-05-26","2023-06-22",
  "2023-07-01","2023-09-30","2023-10-01","2023-10-23",
  "2023-12-22","2023-12-25",
  // 2024 (14 days)
  "2024-01-01","2024-02-10","2024-02-12","2024-02-13",
  "2024-04-04","2024-05-01","2024-05-15","2024-06-10",
  "2024-07-01","2024-09-18","2024-10-01","2024-10-11",
  "2024-12-21","2024-12-25","2024-12-26",
  // 2025 (14 days)
  "2025-01-01","2025-01-29","2025-01-30","2025-01-31",
  "2025-04-04","2025-05-01","2025-05-05","2025-05-31",
  "2025-07-01","2025-10-01","2025-10-07","2025-10-29",
  "2025-12-21","2025-12-25","2025-12-26",
  // 2026 (15 days)
  "2026-01-01","2026-02-17","2026-02-18","2026-02-19",
  "2026-04-05","2026-04-06","2026-05-01","2026-05-24",
  "2026-06-19","2026-07-01","2026-09-26","2026-10-01",
  "2026-10-18","2026-12-22","2026-12-25","2026-12-26",
  // 2027 (15 days)
  "2027-01-01","2027-02-06","2027-02-08","2027-02-09",
  "2027-03-29","2027-04-05","2027-05-01","2027-05-13",
  "2027-06-09","2027-07-01","2027-09-16","2027-10-01",
  "2027-10-08","2027-12-22","2027-12-25","2027-12-27",
  // 2028 (15 days - estimated based on lunar calendar)
  "2028-01-01","2028-01-26","2028-01-27","2028-01-28",
  "2028-04-04","2028-04-17","2028-05-01","2028-06-02",
  "2028-07-01","2028-09-23","2028-10-01","2028-10-25",
  "2028-12-21","2028-12-25","2028-12-26",
]);

// ── Runtime cache (populated from backend function) ──
let _mergedHolidays = null;   // Set<string> | null
let _lastFetchTime   = 0;
const CACHE_TTL_MS   = 24 * 60 * 60 * 1000; // 24 hours

// Legacy variable name for backward compatibility
let _dynamicHolidays = null;

/**
 * Fetch latest holidays from Labour Dept via backend function.
 * Merges with static fallback to ensure complete coverage.
 * Called once per session (result cached for 24h in localStorage too).
 */
export async function refreshHolidaysFromWeb(base44) {
  try {
    // Check localStorage cache first (skip if cache is too old or incomplete)
    const cached = localStorage.getItem("hk_holidays_cache");
    if (cached) {
      const { holidays, ts } = JSON.parse(cached);
      // Only use cache if it has enough holidays (at least 100 days across all years)
      if (Date.now() - ts < CACHE_TTL_MS && holidays.length >= 100) {
        // Merge with static fallback
        _mergedHolidays = new Set([...STATIC_HOLIDAYS, ...holidays]);
        _lastFetchTime = ts;
        return { holidays, source: "localStorage" };
      }
    }

    // Fetch from backend (supplements static fallback with any newly discovered holidays)
    const res = await base44.functions.invoke("fetchHKHolidays", {});
    const { holidays } = res.data;
    if (Array.isArray(holidays) && holidays.length > 0) {
      // Static fallback is primary; merge with dynamic for any additional holidays
      _mergedHolidays = new Set([...STATIC_HOLIDAYS, ...holidays]);
      _lastFetchTime = Date.now();
      localStorage.setItem("hk_holidays_cache", JSON.stringify({ holidays, ts: _lastFetchTime }));
      return { holidays, source: "labour.gov.hk (merged with static backup)" };
    }
  } catch (e) {
    console.warn("Failed to fetch HK holidays from backend, using static fallback:", e.message);
  }
  // Use static fallback (comprehensive 2017-2028)
  _mergedHolidays = STATIC_HOLIDAYS;
  return { holidays: [...STATIC_HOLIDAYS], source: "static backup (2017-2028)" };
}

/**
 * Get the active holiday Set (merged dynamic + static, or static fallback).
 */
function getHolidaySet() {
  return _mergedHolidays || STATIC_HOLIDAYS;
}

/**
 * Returns true if the given Date is a working day
 * (not Sunday, not a HK statutory holiday).
 */
function isWorkingDay(date) {
  if (date.getDay() === 0) return false; // Sunday
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return !getHolidaySet().has(`${yyyy}-${mm}-${dd}`);
}

/**
 * Count working days between start and end (inclusive).
 * @param {string} startStr - "yyyy-mm-dd"
 * @param {string} endStr   - "yyyy-mm-dd"
 * @returns {number}
 */
export function countWorkingDays(startStr, endStr) {
  if (!startStr || !endStr) return 0;
  const start = new Date(startStr + "T00:00:00");
  const end   = new Date(endStr   + "T00:00:00");
  if (isNaN(start) || isNaN(end) || end < start) return 0;

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (isWorkingDay(cur)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/**
 * Add N working days to a start date, returns "yyyy-mm-dd".
 * @param {string} startStr - "yyyy-mm-dd"
 * @param {number} wd - number of working days (inclusive of start)
 * @returns {string} "yyyy-mm-dd"
 */
export function addWorkingDays(startStr, wd) {
  if (!startStr || wd <= 0) return startStr;
  const cur = new Date(startStr + "T00:00:00");
  let counted = 0;
  while (counted < wd) {
    if (isWorkingDay(cur)) counted++;
    if (counted < wd) cur.setDate(cur.getDate() + 1);
  }
  const yyyy = cur.getFullYear();
  const mm = String(cur.getMonth() + 1).padStart(2, "0");
  const dd = String(cur.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns an array of holiday date strings ("yyyy-mm-dd") that fall
 * within the given date range (inclusive). Uses the active holiday set
 * (dynamic from backend if loaded, else static fallback).
 */
export function getHolidaysInRange(startStr, endStr) {
  if (!startStr || !endStr) return [];
  const start = new Date(startStr + "T00:00:00");
  const end   = new Date(endStr   + "T00:00:00");
  if (isNaN(start) || isNaN(end) || end < start) return [];
  const holidays = getHolidaySet();
  const result = [];
  const cur = new Date(start);
  while (cur <= end) {
    const yyyy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, "0");
    const dd = String(cur.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    if (holidays.has(dateStr)) result.push(dateStr);
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

/**
 * Returns info about the current holiday data source.
 */
export function getHolidaySourceInfo() {
  if (_dynamicHolidays) {
    const d = new Date(_lastFetchTime);
    return `勞工處網站 (更新於 ${d.toLocaleDateString("zh-HK")})`;
  }
  return "本地備份資料";
}