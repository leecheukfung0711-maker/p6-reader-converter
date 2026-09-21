"""
Excel parser (Python port of the key JS parseExcel logic).

Supports:
  - Chronology sheets (Date + Summary columns)
  - P6 Activities export (task_code/wbs_id/task_name internal OR human labels)
  - Generic activity sheets (Type/ID/Activity/Start/End)
  - Multi-programme sheets (prefixed BL/DE/Baseline/Delay date columns)
"""
import re
import datetime


def _parse_date(value):
    """Parse a cell value into YYYY-MM-DD. Handles Excel serial numbers."""
    if value is None or value == "":
        return ""
    if isinstance(value, datetime.datetime):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, datetime.date):
        return value.strftime("%Y-%m-%d")
    cleaned = str(value).strip()
    try:
        num = float(cleaned)
        if 30000 < num < 60000:
            d = datetime.datetime(1899, 12, 30) + datetime.timedelta(days=num)
            return d.strftime("%Y-%m-%d")
    except ValueError:
        pass
    m1 = re.match(r"^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})", cleaned)
    if m1:
        return f"{m1.group(1)}-{m1.group(2).zfill(2)}-{m1.group(3).zfill(2)}"
    m2 = re.match(r"^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$", cleaned)
    if m2:
        return f"{m2.group(3)}-{m2.group(1).zfill(2)}-{m2.group(2).zfill(2)}"
    MONTHS = {"JAN": "01", "FEB": "02", "MAR": "03", "APR": "04", "MAY": "05", "JUN": "06",
              "JUL": "07", "AUG": "08", "SEP": "09", "OCT": "10", "NOV": "11", "DEC": "12"}
    m3 = re.match(r"^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$", cleaned)
    if m3:
        yr = m3.group(3)
        if len(yr) == 2:
            yr = "20" + yr
        return f"{yr}-{MONTHS.get(m3.group(2).upper(), '01')}-{m3.group(1).zfill(2)}"
    return ""


def _parse_date_with_actual(value):
    """Return (date, actual). Handles '2024-01-12 A' suffix."""
    if value is None or value == "":
        return ("", False)
    cleaned = str(value).strip()
    m = re.match(r"^(.+?)\s*[Aa]$", cleaned)
    date_str = m.group(1).strip() if m else cleaned
    parsed = _parse_date(date_str)
    return (parsed, bool(m and parsed))


def _is_chronology_sheet(headers):
    h = [str(x).lower().strip() for x in headers]
    return "date" in h and "summary" in h


def _parse_chronology_sheet(rows, header_row, headers):
    h = [str(x).lower().strip() for x in headers]
    date_col = h.index("date") if "date" in h else -1
    summary_col = h.index("summary") if "summary" in h else -1

    def find_idx(pattern):
        for i, x in enumerate(h):
            if re.search(pattern, x):
                return i
        return -1

    ref_col = find_idx(r"doc\.?\s*ref|reference")
    type_col = find_idx(r"document\s*type|doc.*type")
    category_col = find_idx(r"delaying.*event|category")
    no_col = find_idx(r"^no\.?$|^#$")

    tasks = []
    last_category = None
    for i in range(header_row + 1, len(rows)):
        row = rows[i]
        if not row or not any(str(c or "").strip() != "" for c in row):
            continue
        date_raw = str(row[date_col] or "").strip() if date_col >= 0 and date_col < len(row) else ""
        summary = str(row[summary_col] or "").strip() if summary_col >= 0 and summary_col < len(row) else ""
        doc_ref = str(row[ref_col] or "").strip() if ref_col >= 0 and ref_col < len(row) else ""
        doc_type = str(row[type_col] or "").strip() if type_col >= 0 and type_col < len(row) else ""
        category = str(row[category_col] or "").strip() if category_col >= 0 and category_col < len(row) else ""
        no_raw = str(row[no_col] or "").strip() if no_col >= 0 and no_col < len(row) else ""

        if not date_raw and not summary:
            continue
        if category and category != last_category:
            tasks.append({"isSection": True, "sectionType": "blue", "activity": category, "showComparison": False})
            last_category = category
        task = {
            "isSection": False,
            "activityId": doc_ref or no_raw,
            "activity": summary or "(No Summary)",
            "start": _parse_date(date_raw),
            "end": "",
            "barType": "baseline",
            "showComparison": False,
        }
        if doc_type:
            task["item"] = doc_type
        tasks.append(task)
    return tasks


def _p_num(v):
    if v is None or v == "":
        return None
    try:
        n = float(str(v).replace(",", "."))
        return None if n != n else n
    except (ValueError, TypeError):
        return None


def _hrs_to_days(v):
    n = _p_num(v)
    return None if n is None else int(round(n / 8))


def _p_str(v):
    if v is None or v == "":
        return None
    s = str(v).strip()
    return s or None


def _find_col(row0, internal_name, human_pattern):
    h = [str(c or "").lower().strip() for c in row0]
    if internal_name in h:
        return h.index(internal_name)
    for i, x in enumerate(h):
        if re.search(human_pattern, x):
            return i
    return -1


def _is_p6_activities_sheet(rows):
    if len(rows) < 2:
        return False
    row0 = [str(c or "").lower().strip() for c in rows[0]]
    if "task_code" in row0 and "wbs_id" in row0 and "task_name" in row0:
        return True
    if "activity id" in row0 and "wbs code" in row0 and "activity name" in row0:
        return True
    return False


def _parse_p6_activities_sheet(rows):
    row0 = [str(c or "").lower().strip() for c in rows[0]]
    is_internal = "task_code" in row0

    task_code_col = _find_col(row0, "task_code", r"^activity\s*id$")
    wbs_col = _find_col(row0, "wbs_id", r"^wbs\s*code$")
    name_col = _find_col(row0, "task_name", r"^activity\s*name$")
    start_col = _find_col(row0, "start_date", r"^\(\*\)start$|^start$")
    end_col = _find_col(row0, "end_date", r"^\(\*\)finish$|^finish$|^end$")
    delete_col = _find_col(row0, "delete_record_flag", r"^delete")
    rem_dur_col = _find_col(row0, "remain_drtn_hr_cnt", r"rem.*dur|remaining.*dur")
    float_col = _find_col(row0, "total_float_hr_cnt", r"^float$|total\s*float|^tf$")
    pct_col = _find_col(row0, "phys_complete_pct", r"^%.*comp|activity.*%|schedule.*%")
    bl_start_col = _find_col(row0, "bl_start_date", r"bl.*start|baseline.*start|planned.*start")
    bl_end_col = _find_col(row0, "bl_end_date", r"bl.*finish|bl.*end|baseline.*finish|planned.*finish")
    early_start_col = _find_col(row0, "early_start_date", r"early\s*start")
    early_end_col = _find_col(row0, "early_end_date", r"early\s*finish")
    late_start_col = _find_col(row0, "late_start_date", r"late\s*start")
    late_end_col = _find_col(row0, "late_end_date", r"late\s*finish")
    free_float_col = _find_col(row0, "free_float_hr_cnt", r"free\s*float")
    exp_end_col = _find_col(row0, "expect_end_date", r"expected\s*finish")
    rsrc_col = _find_col(row0, "rsrc_id", r"primary\s*resource|^resource")
    dur_type_col = _find_col(row0, "duration_type", r"duration\s*type")
    pct_type_col = _find_col(row0, "complete_pct_type", r"%.*type")
    status_col = _find_col(row0, "status_code", r"^status$")
    cstr_type_col = _find_col(row0, "cstr_type", r"primary\s*constraint$")
    cstr_date_col = _find_col(row0, "cstr_date", r"constraint\s*date|const\.\s*date")
    prior_col = _find_col(row0, "priority_type", r"leveling\s*priority|priority")
    loc_col = _find_col(row0, "location_id", r"location")
    est_wt_col = _find_col(row0, "est_wt", r"est.*wt")
    target_dur_col = _find_col(row0, "target_drtn_hr_cnt", r"plan.*duration|target.*duration")
    act_lab_col = _find_col(row0, "act_work_qty", r"actual.*labor|actual.*work")
    act_nonlab_col = _find_col(row0, "act_equip_qty", r"actual.*nonlabor|actual.*equip")
    rem_lab_col = _find_col(row0, "remain_work_qty", r"rem.*labor|rem.*work")
    plan_lab_col = _find_col(row0, "target_work_qty", r"plan.*labor|budget.*labor")
    dp_flag_col = _find_col(row0, "driving_path_flag", r"longest\s*path|driving\s*path")
    p6_guid_col = _find_col(row0, "guid", r"^guid$")
    p6_task_id_col = _find_col(row0, "task_id", r"^p6\s*id$")

    if name_col < 0:
        return []

    data_start = 2 if is_internal else 1
    tasks = []
    last_wbs_section = None

    for i in range(data_start, len(rows)):
        row = rows[i]
        if not row:
            continue
        name = str(row[name_col] or "").strip() if name_col < len(row) else ""
        task_code = str(row[task_code_col] or "").strip() if task_code_col >= 0 and task_code_col < len(row) else ""
        if not name and not task_code:
            continue
        if delete_col >= 0 and delete_col < len(row) and str(row[delete_col] or "").strip() != "":
            continue

        wbs_id = str(row[wbs_col] or "").strip() if wbs_col >= 0 and wbs_col < len(row) else ""
        dot_idx = wbs_id.find(".", wbs_id.find(".") + 1)
        section_key = wbs_id[:dot_idx] if dot_idx >= 0 else wbs_id
        if section_key != last_wbs_section:
            tasks.append({"isSection": True, "sectionType": "blue",
                          "activity": section_key or wbs_id or "Imported Activities", "showComparison": False})
            last_wbs_section = section_key

        def cell(col, default=""):
            if col >= 0 and col < len(row) and row[col] is not None:
                return row[col]
            return default

        task = {
            "isSection": False,
            "activityId": task_code,
            "activity": name or "(Unnamed)",
            "start": _parse_date(cell(start_col)),
            "end": _parse_date(cell(end_col)),
            "barType": "baseline",
            "showComparison": False,
        }
        for col, key in (
            (bl_start_col, "baselineStart"), (bl_end_col, "baselineFinish"),
            (early_start_col, "earlyStart"), (early_end_col, "earlyEnd"),
            (late_start_col, "lateStart"), (late_end_col, "lateEnd"),
            (cstr_date_col, "constraintDate"), (exp_end_col, "expectedFinish"),
        ):
            if col >= 0:
                val = _parse_date(cell(col))
                if val:
                    task[key] = val
        for col, key, convert in (
            (rem_dur_col, "remainDur", _hrs_to_days),
            (float_col, "float", _hrs_to_days),
            (free_float_col, "freeFloat", _hrs_to_days),
            (target_dur_col, "targetDuration", _hrs_to_days),
            (est_wt_col, "estWt", _p_num),
            (act_lab_col, "actLaborUnits", _p_num),
            (act_nonlab_col, "actNonlaborUnits", _p_num),
            (rem_lab_col, "remLaborUnits", _p_num),
            (plan_lab_col, "planLaborUnits", _p_num),
        ):
            if col >= 0:
                val = convert(_p_num(cell(col)))
                if val is not None:
                    task[key] = val
        if pct_col >= 0:
            v = _p_num(cell(pct_col))
            if v is not None:
                task["pct"] = int(round(v))
        for col, key in (
            (rsrc_col, "primaryResource"), (dur_type_col, "durationType"),
            (pct_type_col, "completePctType"), (status_col, "statusCode"),
            (cstr_type_col, "constraintType"), (prior_col, "priorityType"),
            (loc_col, "locationId"), (dp_flag_col, "drivingPathFlag"),
            (p6_guid_col, "p6Guid"), (p6_task_id_col, "p6TaskId"),
        ):
            if col >= 0:
                val = _p_str(cell(col))
                if val:
                    task[key] = val
        tasks.append(task)
    return tasks


def _parse_multi_programme_sheet(rows, header_row, headers):
    h = [str(x).lower().strip() for x in headers]
    id_col = next((i for i, x in enumerate(h) if re.search(r"activity\s*id|^id|\u4ee3\u865f|\u4ee3\u7801|^code", x)), -1)
    act_col = next(
        (i for i, x in enumerate(h)
         if i != id_col and re.search(r"activity.*name|activity|description|task|name|\u5de5\u5e8f|work", x)
         and not re.search(r"^rp07|^tia|start|finish|^col|^id", x)),
        -1,
    )

    date_pairs = []
    processed = set()

    def normalize_prefix(p):
        if not p:
            return ""
        u = p.upper()
        if u == "BL" or "BASELINE" in u or "AS-PLANNED" in u or "EARLY" in u:
            return "BASELINE"
        if u == "DE" or "DELAY" in u or "ACTUAL" in u or "LATE" in u:
            return "DELAY"
        return u

    for i, hdr in enumerate(h):
        if i in processed:
            continue
        if re.search(r"\s*(start|begin|commence)", hdr):
            prefix = re.sub(r"\s*(start|begin|commence).*$", "", hdr).strip()
            norm = normalize_prefix(prefix)
            end_idx = -1
            for j in range(i + 1, len(h)):
                if j in processed or not re.search(r"end|finish|complete", h[j]):
                    continue
                h_prefix = re.sub(r"\s*(end|finish|complete).*$", "", h[j]).strip()
                if normalize_prefix(h_prefix) == norm:
                    end_idx = j
                    break
            if end_idx >= 0:
                date_pairs.append({
                    "prefix": prefix or f"Programme {len(date_pairs) + 1}",
                    "start_col": i, "end_col": end_idx, "normalized": norm,
                })
                processed.add(i)
                processed.add(end_idx)

    if not date_pairs:
        return []

    tasks = []
    for pair in date_pairs:
        tasks.append({"isSection": True, "sectionType": "blue", "activity": pair["prefix"], "showComparison": False})
        is_delay = "DELAY" in pair["normalized"]
        for i in range(header_row + 1, len(rows)):
            row = rows[i]
            if not row or not any(str(c or "").strip() != "" for c in row):
                continue
            activity_id = str(row[id_col] or "").strip() if id_col >= 0 and id_col < len(row) else ""
            activity = str(row[act_col] or "").strip() if act_col >= 0 and act_col < len(row) else ""
            start = _parse_date(row[pair["start_col"]]) if pair["start_col"] < len(row) else ""
            end = _parse_date(row[pair["end_col"]]) if pair["end_col"] < len(row) else ""
            if (activity_id or activity) and (start or end):
                tasks.append({
                    "activityId": activity_id or "",
                    "activity": activity or "(Unnamed)",
                    "start": start, "end": end,
                    "barType": "delay" if is_delay else "baseline",
                    "isSection": False, "showComparison": False,
                })
    deduped, seen = [], set()
    for t in tasks:
        key = str(t)
        if key not in seen:
            seen.add(key)
            deduped.append(t)
    return deduped


def _is_p6_sheet(headers):
    h = [str(x).lower().strip() for x in headers]
    return any(re.search(r"late\s*start", x) for x in h) and any(re.search(r"late\s*finish", x) for x in h)


def _parse_p6_sheet(rows, header_row, headers):
    h = [str(x).lower().strip() for x in headers]
    id_col = next((i for i, x in enumerate(h) if re.match(r"^p6[\s.]?id$|^activity\s*id$", x)), -1)
    name_col = next((i for i, x in enumerate(h) if re.match(r"^activity\s*name$|^task\s*name$", x)), -1)
    start_col = next((i for i, x in enumerate(h) if re.match(r"^start$", x)), -1)
    finish_col = next((i for i, x in enumerate(h) if re.match(r"^finish$", x)), -1)
    late_start_col = next((i for i, x in enumerate(h) if re.match(r"^late\s*start$", x)), -1)
    late_finish_col = next((i for i, x in enumerate(h) if re.match(r"^late\s*finish$", x)), -1)
    float_col = next((i for i, x in enumerate(h) if re.match(r"^float$|total\s*float|^tf$", x)), -1)
    rem_dur_col = next((i for i, x in enumerate(h) if re.search(r"rem.*dur", x)), -1)
    pct_col = next((i for i, x in enumerate(h) if re.match(r"^%.*comp|activity.*%", x)), -1)
    bl_start_col = next((i for i, x in enumerate(h) if re.match(r"bl.*start|baseline.*start", x)), -1)
    bl_end_col = next((i for i, x in enumerate(h) if re.match(r"bl.*finish|bl.*end", x)), -1)

    if (id_col < 0 and name_col < 0) or start_col < 0 or finish_col < 0:
        return []
    has_late = late_start_col >= 0 and late_finish_col >= 0
    data_rows = []

    for i in range(header_row + 1, len(rows)):
        row = rows[i]
        if not row or not any(str(c or "").strip() != "" for c in row):
            continue

        def cell(col):
            if col >= 0 and col < len(row):
                return row[col]
            return ""

        id_val = str(cell(id_col) or "").strip() if id_col >= 0 else ""
        name_val = str(cell(name_col) or "").strip() if name_col >= 0 else ""
        start = _parse_date(cell(start_col)) if start_col >= 0 else ""
        end = _parse_date(cell(finish_col)) if finish_col >= 0 else ""
        late_start = _parse_date(cell(late_start_col)) if has_late else ""
        late_end = _parse_date(cell(late_finish_col)) if has_late else ""

        if name_val and not start and not end and not late_start and not late_end:
            data_rows.append({"isSection": True, "sectionType": "blue", "activity": name_val})
            continue
        if not id_val and not name_val and not start and not end:
            continue
        row_obj = {
            "isSection": False, "activityId": id_val, "activity": name_val or "(Unnamed)",
            "start": start, "end": end, "lateStart": late_start, "lateEnd": late_end,
            "showComparison": False,
        }
        if bl_start_col >= 0:
            v = _parse_date(cell(bl_start_col))
            if v:
                row_obj["baselineStart"] = v
        if bl_end_col >= 0:
            v = _parse_date(cell(bl_end_col))
            if v:
                row_obj["baselineFinish"] = v
        for col, key in ((float_col, "float"), (rem_dur_col, "remainDur"), (pct_col, "pct")):
            if col >= 0:
                v = _p_num(cell(col))
                if v is not None:
                    row_obj[key] = int(round(v))
        data_rows.append(row_obj)

    if not data_rows:
        return []

    tasks = []
    if not has_late:
        tasks.append({"isSection": True, "sectionType": "blue", "activity": "Baseline Programme", "showComparison": False})
        for r in data_rows:
            if r.get("isSection"):
                tasks.append(r)
                continue
            tasks.append({"activityId": r["activityId"], "activity": r["activity"], "start": r["start"], "end": r["end"],
                          "barType": "baseline", "isSection": False, "showComparison": False})
        return tasks

    def extra(r):
        return {k: v for k, v in r.items() if k in ("baselineStart", "baselineFinish", "float", "remainDur", "pct")}

    tasks.append({"isSection": True, "sectionType": "blue", "activity": "Early Programme (Start / Finish)", "showComparison": False})
    for r in data_rows:
        if r.get("isSection"):
            tasks.append(r)
            continue
        if r["start"] or r["end"]:
            tasks.append({"activityId": r["activityId"], "activity": r["activity"], "start": r["start"], "end": r["end"],
                          "barType": "baseline", "isSection": False, "showComparison": False, **extra(r)})
    tasks.append({"isSection": True, "sectionType": "blue", "activity": "Late Programme (Late Start / Late Finish)", "showComparison": False})
    for r in data_rows:
        if r.get("isSection"):
            tasks.append(r)
            continue
        if r["lateStart"] or r["lateEnd"]:
            tasks.append({"activityId": r["activityId"], "activity": r["activity"], "start": r["lateStart"], "end": r["lateEnd"],
                          "barType": "baseline", "isSection": False, "showComparison": False, **extra(r)})
    return tasks


def _parse_generic_sheet(rows, header_row, headers):
    h = [str(x).lower().strip() for x in headers]
    type_col = next((i for i, x in enumerate(h) if re.match(r"^type$", x)), -1)
    id_col = next((i for i, x in enumerate(h) if re.match(r"^id$|activity.*id|\u4ee3\u865f|\u4ee3\u7801|\u7f16\u53f7|\u8b58\u5225\u78bc", x)), -1)
    act_col = next((i for i, x in enumerate(h) if re.match(r"^activity$|^activity\s+name$|activity.*name|^description$|^name$|^work$|^task$|\u5de5\u5e8f|\u5de5\u7a0b|\u9879\u76ee|\u6d3b\u52d5|\u5167\u5bb9|\u4e8b\u9805", x)), -1)
    start_col = next((i for i, x in enumerate(h) if re.match(r"^start|^commence|^begin|^from|\u958b\u59cb", x)), -1)
    end_col = next((i for i, x in enumerate(h) if re.match(r"^end|^finish|^complete|\u7d50\u675f|\u5b8c\u6210", x)), -1)
    if start_col < 0 or end_col < 0:
        return []

    tasks = []
    for i in range(header_row + 1, len(rows)):
        row = rows[i]
        if not row or not any(str(c or "").strip() != "" for c in row):
            continue

        def cell(col):
            if col >= 0 and col < len(row):
                return str(row[col] or "").strip()
            return ""

        type_raw = cell(type_col).upper() if type_col >= 0 else ""
        activity_id = cell(id_col) if id_col >= 0 else ""
        activity = cell(act_col) if act_col >= 0 else ""
        start_val, start_actual = _parse_date_with_actual(row[start_col] if start_col < len(row) else "")
        end_val, end_actual = _parse_date_with_actual(row[end_col] if end_col < len(row) else "")
        bar_type = "delay" if type_raw == "DE" else "baseline"
        if not activity_id and not activity and not start_val and not end_val:
            continue
        if re.match(r"^WBS-", activity_id) and not start_val and not end_val:
            tasks.append({"isSection": True, "sectionType": "blue", "activity": activity or activity_id, "showComparison": False})
            continue
        task = {
            "activityId": activity_id, "activity": activity or "(Unnamed)",
            "start": start_val, "end": end_val, "barType": bar_type,
            "isSection": False, "showComparison": False,
        }
        if start_actual:
            task["startActual"] = True
        if end_actual:
            task["endActual"] = True
        tasks.append(task)

    deduped, seen = [], set()
    for t in tasks:
        key = str(t)
        if key not in seen:
            seen.add(key)
            deduped.append(t)
    return deduped


def _parse_excel_sheet(rows):
    header_row = 0
    for i, row in enumerate(rows):
        if sum(1 for c in row if str(c or "").strip() != "") >= 2:
            header_row = i
            break
    headers = [str(c or "").strip() for c in rows[header_row]]

    if _is_chronology_sheet(headers):
        return _parse_chronology_sheet(rows, header_row, headers)

    sheet_rows = rows[header_row:]
    if _is_p6_activities_sheet(sheet_rows):
        return _parse_p6_activities_sheet(sheet_rows)

    h = [str(x).lower().strip() for x in headers]
    start_cols = [i for i, x in enumerate(h) if re.search(r"start|begin|commence|\u958b\u59cb", x)]
    end_cols = [i for i, x in enumerate(h) if re.search(r"end|finish|complete|\u7d50\u675f|\u5b8c\u6210", x)]
    has_programme_prefixes = any(re.search(r"\b(bl|baseline|de|delay|as-planned|actual|early|late)\s+(start|end|finish|begin)", x) for x in h)
    if (len(start_cols) >= 2 and len(end_cols) >= 2) or has_programme_prefixes:
        return _parse_multi_programme_sheet(rows, header_row, headers)
    if _is_p6_sheet(headers):
        return _parse_p6_sheet(rows, header_row, headers)
    return _parse_generic_sheet(rows, header_row, headers)


def _parse_csv(text):
    import csv
    from io import StringIO
    reader = csv.reader(StringIO(text))
    rows = [[c for c in row] for row in reader]
    if not rows:
        return []
    return _parse_excel_sheet(rows)


def parse_excel(file_bytes, filename=""):
    """Parse an Excel workbook (xlsx/xls bytes) into a list of tasks."""
    if filename.lower().endswith(".csv"):
        return _parse_csv(file_bytes.decode("utf-8-sig", errors="replace"))
    try:
        import openpyxl
    except ImportError:
        return _parse_csv(file_bytes.decode("utf-8-sig", errors="replace"))

    try:
        from io import BytesIO
        wb = openpyxl.load_workbook(BytesIO(file_bytes), data_only=True)
    except Exception:
        try:
            return _parse_csv(file_bytes.decode("utf-8-sig", errors="replace"))
        except Exception:
            return []

    all_tasks, seen = [], set()
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        rows = []
        for row in ws.iter_rows(values_only=True):
            rows.append(["" if v is None else v for v in row])
        if not rows:
            continue
        for t in _parse_excel_sheet(rows):
            key = str(t)
            if key not in seen:
                seen.add(key)
                all_tasks.append(t)
    return all_tasks