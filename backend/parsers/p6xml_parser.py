"""
Primavera P6 PMXML file parser (Python port of the JS parseP6XML)

Supports the Primavera P6 PMXML export format (*.xml):
  <Project> → <WBS> + <Activity> + <Relationship>
Also falls back to generic XML with Activity/Task elements.
"""
import re
import xml.etree.ElementTree as ET

HOURS_PER_DAY = 8

TYPE_MAP = {
    "Finish to Start": "FS",
    "Start to Start": "SS",
    "Finish to Finish": "FF",
    "Start to Finish": "SF",
}


def _normalise_date(s):
    if not s:
        return ""
    m = re.match(r"^(\d{4}-\d{2}-\d{2})", str(s))
    if m:
        return m.group(1)
    # Fall back to generic date parsing
    cleaned = str(s).strip()
    m1 = re.match(r"^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})", cleaned)
    if m1:
        return f"{m1.group(1)}-{m1.group(2).zfill(2)}-{m1.group(3).zfill(2)}"
    m2 = re.match(r"^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})", cleaned)
    if m2:
        return f"{m2.group(3)}-{m2.group(1).zfill(2)}-{m2.group(2).zfill(2)}"
    return ""


def _get_text(el, tag):
    """Text content of first child element with tag (case-insensitive lookup)."""
    for child in el:
        if child.tag.rsplit("}", 1)[-1] == tag:
            return (child.text or "").strip()
    # Also check direct attribute
    if el.get(tag):
        return el.get(tag).strip()
    return ""


def _tag_name(tag):
    return tag.rsplit("}", 1)[-1]


def _children_named(el, tag):
    return [c for c in el if _tag_name(c.tag) == tag]


def parse_p6xml(xml_text):
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return None

    tasks = []

    # ── Approach 1: PMXML format (<Project> → <WBS> + <Activity>) ───────────
    projects = _children_named(root, "Project")
    if not projects and root.tag.rsplit("}", 1)[-1] == "Project":
        projects = [root]

    if projects:
        for proj in projects:
            # Build WBS id → name/object map
            wbs_map = {}
            for w in proj.iter():
                if _tag_name(w.tag) != "WBS":
                    continue
                wbs_id = _get_text(w, "ObjectId") or w.get("ObjectId") or ""
                code = _get_text(w, "Code") or _get_text(w, "Name") or wbs_id
                name = _get_text(w, "Name") or code
                wbs_map[wbs_id] = {
                    "code": code,
                    "name": name,
                    "parentId": _get_text(w, "ParentObjectId") or None,
                }

            def get_wbs_name(wbs_id, wbs_map=wbs_map):
                entry = wbs_map.get(wbs_id)
                return entry["name"] if entry else wbs_id

            # objectId → activityId map for relationship resolution
            obj_id_to_act_id = {}
            activities = []
            for el in proj.iter():
                if _tag_name(el.tag) != "Activity":
                    continue
                obj_id = _get_text(el, "ObjectId") or el.get("ObjectId") or ""
                act_id = _get_text(el, "Id") or _get_text(el, "ActivityId") or obj_id
                if obj_id:
                    obj_id_to_act_id[obj_id] = act_id
                activities.append(el)

            # Parse relationships: predecessor ObjectId → first relationship
            rels_by_pred_obj_id = {}
            for rel in proj.iter():
                if _tag_name(rel.tag) != "Relationship":
                    continue
                pred_obj_id = _get_text(rel, "PredecessorActivityObjectId") or rel.get("PredecessorActivityObjectId") or ""
                succ_obj_id = _get_text(rel, "SuccessorActivityObjectId") or rel.get("SuccessorActivityObjectId") or ""
                rel_type = _get_text(rel, "Type") or "Finish to Start"
                try:
                    lag_hours = float(_get_text(rel, "Lag") or "0")
                except ValueError:
                    lag_hours = 0.0
                lag_days = round(lag_hours / HOURS_PER_DAY)
                succ_act_id = obj_id_to_act_id.get(succ_obj_id) or succ_obj_id
                link_code = TYPE_MAP.get(rel_type, "FS")
                if pred_obj_id and pred_obj_id not in rels_by_pred_obj_id:
                    rels_by_pred_obj_id[pred_obj_id] = {
                        "succActId": succ_act_id,
                        "linkCode": link_code,
                        "lagDays": lag_days,
                    }

            # Emit in WBS order
            last_wbs = None
            for act in activities:
                wbs_id = _get_text(act, "WBSObjectId") or _get_text(act, "WBSId") or ""
                if wbs_id != last_wbs:
                    tasks.append({"isSection": True, "sectionType": "blue", "activity": get_wbs_name(wbs_id), "showComparison": False})
                    last_wbs = wbs_id

                obj_id = _get_text(act, "ObjectId") or act.get("ObjectId") or ""
                act_id = _get_text(act, "Id") or _get_text(act, "ActivityId") or obj_id
                act_name = _get_text(act, "Name")
                act_type = _get_text(act, "Type")

                actual_start = _normalise_date(
                    _get_text(act, "ActualStartDate") or _get_text(act, "ActualStart")
                )
                actual_finish = _normalise_date(
                    _get_text(act, "ActualFinishDate") or _get_text(act, "ActualFinish")
                )
                early_start = _normalise_date(
                    _get_text(act, "StartDate")
                    or _get_text(act, "EarlyStartDate")
                    or _get_text(act, "PlannedStartDate")
                    or _get_text(act, "Start")
                )
                early_finish = _normalise_date(
                    _get_text(act, "FinishDate")
                    or _get_text(act, "EarlyFinishDate")
                    or _get_text(act, "PlannedFinishDate")
                    or _get_text(act, "Finish")
                )

                start = actual_start or early_start
                end = actual_finish or early_finish

                if act_type in ("StartMilestone", "MilestoneStart"):
                    end = ""
                elif act_type in ("FinishMilestone", "MilestoneFinish"):
                    start = ""

                rel = rels_by_pred_obj_id.get(obj_id)
                task = {
                    "isSection": False,
                    "activityId": act_id,
                    "activity": act_name or "(Unnamed)",
                    "start": start,
                    "end": end,
                    "barType": "baseline",
                    "startActual": True if actual_start else None,
                    "endActual": True if actual_finish else None,
                    "showComparison": False,
                }
                if rel:
                    task["link"] = rel["linkCode"]
                    task["lag"] = rel["lagDays"]
                    task["relType"] = rel["linkCode"]
                    task["links"] = [{"succCode": rel["succActId"], "type": rel["linkCode"], "lag": rel["lagDays"]}]
                tasks.append(task)

        if tasks:
            return tasks

    # ── Approach 2: Generic XML with Activity/Task elements ─────────────────
    act_els = []
    for el in root.iter():
        tag = _tag_name(el.tag)
        if tag in ("Activity", "Task", "task", "activity"):
            act_els.append(el)

    if act_els:
        result = [{"isSection": True, "sectionType": "blue", "activity": "Imported Activities", "showComparison": False}]
        for act in act_els:
            act_id = _get_text(act, "Id") or _get_text(act, "ID") or act.get("id") or ""
            act_name = _get_text(act, "Name") or _get_text(act, "name") or _get_text(act, "Title") or ""
            start = _normalise_date(_get_text(act, "StartDate") or _get_text(act, "Start") or _get_text(act, "start_date"))
            end = _normalise_date(_get_text(act, "FinishDate") or _get_text(act, "Finish") or _get_text(act, "end_date"))
            if not act_name and not start and not end:
                continue
            result.append({
                "isSection": False,
                "activityId": act_id,
                "activity": act_name or "(Unnamed)",
                "start": start,
                "end": end,
                "barType": "baseline",
                "showComparison": False,
            })
        if len(result) > 1:
            return result

    return None