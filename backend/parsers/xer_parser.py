"""
Primavera P6 XER file parser (Python port of the JS parseXER.js)

XER format:
  %T <TABLE_NAME>       – starts a table section
  %F <col1>\t<col2>...  – field names (tab-separated)
  %R <val1>\t<val2>...  – data rows (tab-separated)
  %E                    – end of file

Tables parsed: TASK, PROJWBS, PROJECT, TASKPRED
"""
import re

P6_LINK_TYPE = {"PR_FS": "FS", "PR_FF": "FF", "PR_SS": "SS", "PR_SF": "SF"}


def parse_xer_tables(text):
    tables = {}
    current_table = None
    current_fields = []

    for line in text.splitlines():
        if line.startswith("%T\t") or line.startswith("%T "):
            current_table = line[3:].strip()
            current_fields = []
            tables.setdefault(current_table, [])
        elif line.startswith("%F\t"):
            current_fields = [f.strip() for f in line[3:].split("\t")]
        elif line.startswith("%R\t") and current_table:
            values = line[3:].split("\t")
            row = {}
            for i, f in enumerate(current_fields):
                row[f] = (values[i] if i < len(values) else "").strip()
            tables[current_table].append(row)
    return tables


def parse_p6_date(raw):
    if not raw:
        return ""
    s = raw.strip()
    m1 = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m1:
        return f"{m1.group(1)}-{m1.group(2)}-{m1.group(3)}"
    MONTHS = {
        "JAN": "01", "FEB": "02", "MAR": "03", "APR": "04", "MAY": "05", "JUN": "06",
        "JUL": "07", "AUG": "08", "SEP": "09", "OCT": "10", "NOV": "11", "DEC": "12",
    }
    m2 = re.match(r"^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$", s)
    if m2:
        yr = m2.group(3)
        if len(yr) == 2:
            yr = "20" + yr
        month = MONTHS.get(m2.group(2).upper(), "01")
        return f"{yr}-{month}-{m2.group(1).zfill(2)}"
    m3 = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", s)
    if m3:
        return f"{m3.group(3)}-{m3.group(1).zfill(2)}-{m3.group(2).zfill(2)}"
    return ""


def _to_float(raw):
    if raw is None or raw == "":
        return None
    try:
        return float(str(raw).replace(",", "."))
    except (ValueError, TypeError):
        return None


def hrs_to_days(raw):
    n = _to_float(raw)
    if n is None:
        return None
    return int(round(n / 8))


def _build_task(t, pred_links_map, original_map):
    start = parse_p6_date(
        t.get("act_start_date") or t.get("early_start_date")
        or t.get("target_start_date") or t.get("restart_date") or ""
    )
    end = parse_p6_date(
        t.get("act_end_date") or t.get("early_end_date")
        or t.get("target_end_date") or t.get("reend_date") or ""
    )

    task_start, task_end = start, end
    task_type = t.get("task_type", "")
    if task_type in ("TT_Mile", "TT_StartMile"):
        task_start = start or end
        task_end = ""
    elif task_type == "TT_FinMile":
        task_end = end or start
        task_start = ""

    pls = pred_links_map.get(t.get("task_code", ""), [])
    pl0 = pls[0] if pls else {}
    link_type = pl0.get("link")
    link_succ_code = pl0.get("succCode")
    link_lag = pl0.get("lag", 0) if pl0 else None
    links = [
        {"succCode": r["succCode"], "type": r["link"], "lag": r["lag"]}
        for r in pls
    ]

    pct = None
    pct_type = (t.get("complete_pct_type") or "").strip()
    status_code = (t.get("status_code") or "").strip()

    if pct_type in ("CP_Phys", "CP_Units"):
        v = _to_float(t.get("phys_complete_pct", ""))
        if v is not None:
            pct = int(round(v))
    elif pct_type == "CP_Drtn":
        if status_code == "TK_Complete":
            pct = 100
        elif status_code == "TK_NotStart":
            pct = 0
        else:
            remain = _to_float(t.get("remain_drtn_hr_cnt", ""))
            target = _to_float(t.get("target_drtn_hr_cnt", ""))
            if (
                remain is not None and target is not None
                and target > 0 and remain <= target
            ):
                pct = int(round((1 - remain / target) * 100))
    else:
        raw = t.get("phys_complete_pct") or t.get("sched_complete_pct") or ""
        v = _to_float(raw)
        if v is not None:
            pct = int(round(v * 100)) if 0 < v <= 1 else int(round(v))

    bl_start = parse_p6_date(
        t.get("primary_base_start_date") or t.get("secondary_base_start_date")
        or t.get("base_start_date") or ""
    )
    bl_end = parse_p6_date(
        t.get("primary_base_end_date") or t.get("secondary_base_end_date")
        or t.get("base_end_date") or ""
    )

    def extract_date(val):
        parsed = parse_p6_date(val)
        return parsed or None

    def extract_hrs(val):
        n = _to_float(val)
        return None if n is None else int(round(n / 8))

    def extract_num(val):
        return _to_float(val)

    def extract_str(val):
        return str(val).strip() if val else None

    float_raw = _to_float(t.get("total_float_hr_cnt", ""))
    task_obj = {
        "activityId": t.get("task_code", ""),
        "activity": t.get("task_name", ""),
        "start": task_start,
        "end": task_end,
        "barType": "baseline",
        "baselineStart": bl_start or None,
        "baselineFinish": bl_end or None,
        "startActual": True if (t.get("act_start_date") or "").strip() else None,
        "endActual": True if (t.get("act_end_date") or "").strip() else None,
        "linkType": link_type,
        "linkOffset": link_lag,
        "linkSuccCode": link_succ_code,
        "relType": link_type,
        "links": links if links else None,
        "remainDur": hrs_to_days(t.get("remain_drtn_hr_cnt", "")),
        "float": int(round(float_raw / 8)) if float_raw is not None else None,
        "pct": pct,
        "earlyStart": extract_date(t.get("early_start_date", "")),
        "earlyEnd": extract_date(t.get("early_end_date", "")),
        "lateStart": extract_date(t.get("late_start_date", "")),
        "lateEnd": extract_date(t.get("late_end_date", "")),
        "freeFloat": extract_hrs(t.get("free_float_hr_cnt", "")),
        "expectedFinish": extract_date(t.get("expect_end_date", "")),
        "primaryResource": extract_str(t.get("rsrc_id", "")),
        "durationType": extract_str(t.get("duration_type", "")),
        "completePctType": extract_str(t.get("complete_pct_type", "")),
        "statusCode": extract_str(t.get("status_code", "")),
        "constraintType": extract_str(t.get("cstr_type", "")),
        "constraintDate": extract_date(t.get("cstr_date", "")),
        "constraintType2": extract_str(t.get("cstr_type2", "")),
        "constraintDate2": extract_date(t.get("cstr_date2", "")),
        "suspendDate": extract_date(t.get("suspend_date", "")),
        "resumeDate": extract_date(t.get("resume_date", "")),
        "priorityType": extract_str(t.get("priority_type", "")),
        "locationId": extract_str(t.get("location_id", "")),
        "estWt": extract_num(t.get("est_wt", "")),
        "drivingPathFlag": extract_str(t.get("driving_path_flag", "")),
        "lockPlanFlag": extract_str(t.get("lock_plan_flag", "")),
        "autoComputeActFlag": extract_str(t.get("auto_compute_act_flag", "")),
        "actLaborUnits": extract_num(t.get("act_work_qty", "")),
        "actNonlaborUnits": extract_num(t.get("act_equip_qty", "")),
        "remLaborUnits": extract_num(t.get("remain_work_qty", "")),
        "remNonlaborUnits": extract_num(t.get("remain_equip_qty", "")),
        "planLaborUnits": extract_num(t.get("target_work_qty", "")),
        "planNonlaborUnits": extract_num(t.get("target_equip_qty", "")),
        "reviewFinish": extract_date(t.get("review_end_date", "")),
        "reviewStatus": extract_str(t.get("review_type", "")),
        "externalEarlyStart": extract_date(t.get("external_early_start_date", "")),
        "externalLateFinish": extract_date(t.get("external_late_end_date", "")),
        "remEarlyStart": extract_date(t.get("restart_date", "")),
        "remEarlyFinish": extract_date(t.get("reend_date", "")),
        "remLateStart": extract_date(t.get("rem_late_start_date", "")),
        "remLateFinish": extract_date(t.get("rem_late_end_date", "")),
        "floatPath": extract_num(t.get("float_path", "")),
        "floatPathOrder": extract_num(t.get("float_path_order", "")),
        "p6Guid": extract_str(t.get("guid", "")),
        "p6TaskId": extract_str(t.get("task_id", "")),
        "targetDuration": extract_hrs(t.get("target_drtn_hr_cnt", "")),
        "showComparison": False,
        "_originalXerData": original_map.get(t.get("task_code", ""), {}),
    }
    return {k: v for k, v in task_obj.items() if v is not None and v != ""}


def parse_xer(text):
    tables = parse_xer_tables(text)

    task_rows = tables.get("TASK", [])
    wbs_rows = tables.get("PROJWBS", [])
    proj_rows = tables.get("PROJECT", [])
    pred_rows = tables.get("TASKPRED", [])

    if not task_rows:
        return None

    task_id_to_code = {}
    for t in task_rows:
        task_id_to_code[t.get("task_id", "")] = t.get("task_code", "")

    original_task_data = {}
    for t in task_rows:
        original_task_data[t.get("task_code", "")] = {**t}

    pred_links = {}
    for p in pred_rows:
        pred_code = task_id_to_code.get(p.get("pred_task_id", ""))
        succ_code = task_id_to_code.get(p.get("task_id", ""))
        if not pred_code or not succ_code:
            continue
        link_type = P6_LINK_TYPE.get(p.get("pred_type", ""))
        if not link_type:
            continue
        lag_days = int(round((_to_float(p.get("lag_hr_cnt", "0")) or 0) / 8))
        pred_links.setdefault(pred_code, []).append(
            {"link": link_type, "lag": lag_days, "succCode": succ_code}
        )

    wbs_map = {}
    for w in wbs_rows:
        wbs_map[w.get("wbs_id", "")] = {
            "name": w.get("wbs_name") or w.get("wbs_short_name") or w.get("wbs_id", ""),
            "parentId": w.get("parent_wbs_id") or None,
        }

    wbs_ids = {w.get("wbs_id", "") for w in wbs_rows}
    top_level_wbs = [
        w for w in wbs_rows
        if not w.get("parent_wbs_id") or w.get("parent_wbs_id") not in wbs_ids
    ]

    tasks_by_wbs = {}
    for t in task_rows:
        tasks_by_wbs.setdefault(t.get("wbs_id", ""), []).append(t)

    def flatten_wbs(wbs_id):
        items = []
        name = wbs_map.get(wbs_id, {}).get("name") or wbs_id
        items.append({"isSection": True, "sectionType": "blue", "activity": name, "showComparison": False})
        for t in tasks_by_wbs.get(wbs_id, []):
            items.append(_build_task(t, pred_links, original_task_data))
        for child in [w for w in wbs_rows if w.get("parent_wbs_id") == wbs_id]:
            items.extend(flatten_wbs(child.get("wbs_id", "")))
        return items

    result = []

    if wbs_rows:
        for w in top_level_wbs:
            result.extend(flatten_wbs(w.get("wbs_id", "")))

        assigned = {r.get("activityId") for r in result if r.get("activityId")}
        unassigned = [t for t in task_rows if t.get("task_code", "") not in assigned]
        if unassigned:
            result.append({"isSection": True, "sectionType": "blue", "activity": "Other Activities", "showComparison": False})
            for t in unassigned:
                result.append(_build_task(t, pred_links, original_task_data))
    else:
        proj_name = (proj_rows[0] or {}).get("proj_short_name") or (proj_rows[0] or {}).get("proj_id") or "Imported Activities"
        result.append({"isSection": True, "sectionType": "blue", "activity": proj_name, "showComparison": False})
        for t in task_rows:
            result.append(_build_task(t, pred_links, original_task_data))

    cleaned = []
    for i, r in enumerate(result):
        if r.get("isSection"):
            nxt = result[i + 1] if i + 1 < len(result) else None
            if not nxt or nxt.get("isSection"):
                continue
        cleaned.append(r)

    return cleaned if cleaned else None