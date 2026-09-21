/**
 * exportP6XML.js
 * Generates a Primavera P6 PMXML export matching the P6Professional V22.12 schema.
 * Structure based on official P6 export format (Ken1xml.txt reference).
 */

const CAL_OBJ_ID = 6593;
const NIL = `xsi:nil="true"`;

function esc(str) {
  if (!str && str !== 0) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Generate deterministic GUID from object ID
function genGuid(objId) {
  const hex = objId.toString(16).padStart(8, '0');
  const pad = (s, n) => s.padStart(n, '0');
  // Format: {XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}
  const h1 = pad(hex.slice(0,8), 8);
  const h2 = pad(hex.slice(0,4), 4);
  const h3 = pad(hex.slice(4,8), 4);
  const h4 = pad(hex.slice(0,4), 4);
  const h5 = pad(hex.slice(0,12), 12);
  return `{${h1}-${h2}-${h3}-${h4}-${h5}}`.toUpperCase();
}

// "YYYY-MM-DD" → "YYYY-MM-DDTHH:MM:SS"
function dt(dateStr, isEnd = false) {
  if (!dateStr) return null;
  return `${dateStr}T${isEnd ? "17:00:00" : "07:00:00"}`;
}

// Duration in hours between two date strings (approx 8h/day)
function durHours(start, end) {
  if (!start || !end) return 8;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms <= 0) return 8;
  const days = Math.round(ms / 86400000);
  return Math.max(8, days * 8);
}

export function buildP6XML(tasks, opts = {}) {
  const {
    projectId = "PROJ001",
    projectName = "Exported Project",
    exportDate = new Date().toISOString().slice(0, 10),
  } = opts;

  // Fixed object IDs matching P6 Professional defaults
  const projObjId = 5844;
  const wbsObjId = 63051;
  const dataDateTime = `${exportDate}T00:00:00`;

  // ── Build WBS from sections ───────────────────────────────────────────────
  const wbsList = [];
  let wbsCounter = 0;
  tasks.forEach(t => {
    if (t.isSection) {
      wbsList.push({
        objectId: 186733 + wbsCounter++,
        code: `${projectId}`,
        name: t.activity || `WBS ${wbsCounter}`,
        parentId: null,
      });
    }
  });

  // ── Activities ────────────────────────────────────────────────────────────
  const activities = [];
  let actObjId = 248321;
  let relObjId = 277280;
  let wbsIndex = 0;

  tasks.forEach(t => {
    if (t.isSection) {
      wbsIndex++;
      return;
    }
    const id = (t.activityId || "").trim() || `A${String(actObjId)}`;
    const name = t.activity || "(Unnamed)";
    let status = "Not Started";
    if (t.endActual) status = "Completed";
    else if (t.startActual) status = "In Progress";
    
    const startDt  = dt(t.start);
    const finishDt = dt(t.end, true);
    const plStart  = dt(t.baselineStart || t.start);
    const plFinish = dt(t.baselineFinish || t.end, true);
    const actStart  = t.startActual ? dt(t.start) : null;
    const actFinish = t.endActual   ? dt(t.end, true) : null;
    const dur = durHours(t.start, t.end);
    
    const currentWbs = wbsList[wbsIndex - 1] || wbsList[0];
    
    // Remaining duration: use task's remainDur (converted to hours), fallback to total dur
    let remDurHrs = dur;
    if (t.remainDur != null) {
      remDurHrs = t.remainDur * 8;
    } else if (t.endActual) {
      remDurHrs = 0;
    }
    
    // % complete
    const pct = t.pct != null ? t.pct : (t.endActual ? 100 : t.startActual ? 50 : 0);
    
    // Additional P6 fields from import
    const earlyStartDt  = dt(t.earlyStart || t.start);
    const earlyFinishDt = dt(t.earlyEnd || t.end, true);
    const lateStartDt   = dt(t.lateStart);
    const lateFinishDt  = dt(t.lateEnd, true);
    const expFinishDt   = dt(t.expectedFinish, true);
    const constDate     = dt(t.constraintDate);
    const constDate2    = dt(t.constraintDate2);
    const suspDate      = dt(t.suspendDate);
    const resDate       = dt(t.resumeDate);
    const extEarlyDt    = dt(t.externalEarlyStart);
    const extLateDt     = dt(t.externalLateFinish, true);
    
    activities.push({
      objectId: actObjId++,
      id, name, status, dur, remDurHrs, pct,
      startDt, finishDt, plStart, plFinish, actStart, actFinish,
      earlyStartDt, earlyFinishDt, lateStartDt, lateFinishDt,
      expFinishDt, constDate, constDate2, suspDate, resDate,
      extEarlyDt, extLateDt,
      wbsObjId: currentWbs?.objectId || null,
      link: t.link, lag: t.lag ?? t.linkOffset ?? 0, _taskId: t.id,
      // Multi-relationship array from XER/XML import: [{ succId, succCode, type, lag }]
      links: Array.isArray(t.links) ? t.links : null,
      // Freshly parsed XER rows carry linkSuccCode instead of `link`
      linkSuccCode: t.linkSuccCode || null,
      linkTypeFallback: t.relType || t.linkType || null,
      linkLagFallback: t.linkOffset ?? t.linkLag ?? null,
      // Extra fields from P6 import
      durType: t.durationType,
      statusCode: t.statusCode,
      primRes: t.primaryResource,
      constraintType: t.constraintType,
      constraintType2: t.constraintType2,
      priorityType: t.priorityType,
      drivingPath: t.drivingPathFlag,
      autoCompute: t.autoComputeActFlag,
      lockPlan: t.lockPlanFlag,
      reviewFinish: t.reviewFinish,
      reviewStatus: t.reviewStatus,
      targetDuration: t.targetDuration,
    });
  });

  // ── Relationships ─────────────────────────────────────────────────────────
  const relationships = [];
  const actByTaskId = {};
  const actByCode = {};                       // activityId → activity (fallback for succCode)
  activities.forEach(a => {
    actByTaskId[a._taskId] = a;
    if (a.id) actByCode[String(a.id).trim().toLowerCase()] = a;
  });

  // P6 stores Lag in HOURS (not days). Convert days → hours using calendar hours/day.
  // The calendar used here is 9h/day (matching *C1 - 7d/wk style) but the reference
  // P6 export shows the default cal (12006) uses 9h/day. We use the same CAL_OBJ_ID
  // calendar which is 8h/day, so 1 lag day = 8 hours.
  const HOURS_PER_LAG_DAY = 8;

  const pushRel = (predAct, succAct, type, lagDays) => {
    if (!predAct || !succAct) return;
    relationships.push({
      objectId: relObjId++,
      predObjId: predAct.objectId,
      succObjId: succAct.objectId,
      type,
      lag: (Number(lagDays) || 0) * HOURS_PER_LAG_DAY,   // P6 stores lag in HOURS
    });
  };

  activities.forEach((act, idx) => {
    const emitted = new Set();   // successor object ids already written for this activity

    // 1) `links` array (XER / XML import) — may hold SEVERAL relationships per
    //    activity, each with its own type (FS/SS/FF/SF) and lag. Previously ignored,
    //    so exporting a multi-link programme silently dropped every relationship
    //    except the legacy single `link`.
    (act.links || []).forEach((l) => {
      const succ = (l && l.succId != null ? actByTaskId[l.succId] : null)
        || (l && l.succCode ? actByCode[String(l.succCode).trim().toLowerCase()] : null);
      if (!succ || emitted.has(succ.objectId)) return;
      emitted.add(succ.objectId);
      pushRel(act, succ, relTypeLabel(l.type || "FS"), l.lag);
    });

    // 2) legacy single `link` (manual chain binding); falls back to the freshly parsed
    //    XER fields (linkSuccCode) so a raw parseXER result also keeps its relationships
    if (act.link) {
      const isBindChain = typeof act.link === "number" || /^\d+$/.test(String(act.link));
      const succ = isBindChain ? (actByTaskId[act.link] || activities[idx + 1]) : activities[idx + 1];
      if (succ && !emitted.has(succ.objectId)) {
        emitted.add(succ.objectId);
        pushRel(act, succ, isBindChain ? "Finish to Start" : relTypeLabel(act.link), act.lag);
      }
    } else if (act.linkSuccCode) {
      const succ = actByCode[String(act.linkSuccCode).trim().toLowerCase()];
      if (succ && !emitted.has(succ.objectId)) {
        emitted.add(succ.objectId);
        pushRel(act, succ, relTypeLabel(act.linkTypeFallback || "FS"), act.linkLagFallback);
      }
    }
  });

  // ── XML Build ─────────────────────────────────────────────────────────────
  const L = [];
  const p = (s) => L.push(s);

  p(`<?xml version="1.0" encoding="utf-8"?>`);
  p(`<APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6Professional/V22.12/API/BusinessObjects" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://xmlns.oracle.com/Primavera/P6Professional/V22.12/API/BusinessObjects http://xmlns.oracle.com/Primavera/P6Professional/V22.12/API/p6apibo.xsd">`);

  // ── DisplayCurrency ───────────────────────────────────────────────────────
  p(`  <DisplayCurrency>`);
  p(`    <Currency>`);
  p(`      <DecimalPlaces>2</DecimalPlaces>`);
  p(`      <DecimalSymbol>Period</DecimalSymbol>`);
  p(`      <DigitGroupingSymbol>Comma</DigitGroupingSymbol>`);
  p(`      <ExchangeRate>1</ExchangeRate>`);
  p(`      <Id>USD</Id>`);
  p(`      <Name>US Dollar</Name>`);
  p(`      <NegativeSymbol>(#1.1)</NegativeSymbol>`);
  p(`      <ObjectId>1</ObjectId>`);
  p(`      <PositiveSymbol>#1.1</PositiveSymbol>`);
  p(`      <Symbol>$</Symbol>`);
  p(`    </Currency>`);
  p(`  </DisplayCurrency>`);

  // ── Currency ──────────────────────────────────────────────────────────────
  p(`  <Currency>`);
  p(`    <DecimalPlaces>2</DecimalPlaces>`);
  p(`    <DecimalSymbol>Period</DecimalSymbol>`);
  p(`    <DigitGroupingSymbol>Comma</DigitGroupingSymbol>`);
  p(`    <ExchangeRate>1</ExchangeRate>`);
  p(`    <Id>USD</Id>`);
  p(`    <Name>US Dollar</Name>`);
  p(`    <NegativeSymbol>(#1.1)</NegativeSymbol>`);
  p(`    <ObjectId>1</ObjectId>`);
  p(`    <PositiveSymbol>#1.1</PositiveSymbol>`);
  p(`    <Symbol>$</Symbol>`);
  p(`  </Currency>`);

  // ── OBS ───────────────────────────────────────────────────────────────────
  p(`  <OBS>`);
  p(`    <Description>&lt;html&gt;`);
  p(`  &lt;head&gt;`);
  p(`    `);
  p(`  &lt;/head&gt;`);
  p(``);
  p(`  &lt;body bgcolor="#ffffff"&gt;`);
  p(`    Enterprise`);
  p(`  &lt;/body&gt;`);
  p(``);
  p(`&lt;/html&gt;</Description>`);
  p(`    <GUID ${NIL}/>`);
  p(`    <Name>Enterprise</Name>`);
  p(`    <ObjectId>540</ObjectId>`);
  p(`    <ParentObjectId ${NIL}/>`);
  p(`    <SequenceNumber>0</SequenceNumber>`);
  p(`  </OBS>`);

  // ── Calendar ──────────────────────────────────────────────────────────────
  p(`  <Calendar>`);
  p(`    <BaseCalendarObjectId ${NIL}/>`);
  p(`    <HoursPerDay>8</HoursPerDay>`);
  p(`    <HoursPerMonth>242</HoursPerMonth>`);
  p(`    <HoursPerWeek>56</HoursPerWeek>`);
  p(`    <HoursPerYear>2920</HoursPerYear>`);
  p(`    <IsDefault>0</IsDefault>`);
  p(`    <IsPersonal>0</IsPersonal>`);
  p(`    <Name>02 - 7 D/W (No Holiday)</Name>`);
  p(`    <ObjectId>${CAL_OBJ_ID}</ObjectId>`);
  p(`    <ProjectObjectId ${NIL}/>`);
  p(`    <Type>Global</Type>`);
  p(`    <StandardWorkWeek>`);
  ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].forEach(day => {
    p(`      <StandardWorkHours>`);
    p(`        <DayOfWeek>${day}</DayOfWeek>`);
    p(`        <WorkTime>`);
    p(`          <Start>07:00:00</Start>`);
    p(`          <Finish>16:59:00</Finish>`);
    p(`        </WorkTime>`);
    p(`      </StandardWorkHours>`);
  });
  p(`    </StandardWorkWeek>`);
  p(`  </Calendar>`);

  // ── FinancialPeriodTemplate ───────────────────────────────────────────────
  p(`  <FinancialPeriodTemplate>`);
  p(`    <FinancialPeriodTemplateName>Calendar</FinancialPeriodTemplateName>`);
  p(`    <ObjectId>1</ObjectId>`);
  p(`  </FinancialPeriodTemplate>`);

  // ── Project ───────────────────────────────────────────────────────────────
  p(`  <Project>`);
  p(`    <ActivityDefaultActivityType>Task Dependent</ActivityDefaultActivityType>`);
  p(`    <ActivityDefaultCalendarObjectId>${CAL_OBJ_ID}</ActivityDefaultCalendarObjectId>`);
  p(`    <ActivityDefaultCostAccountObjectId ${NIL}/>`);
  p(`    <ActivityDefaultDurationType>Fixed Duration and Units</ActivityDefaultDurationType>`);
  p(`    <ActivityDefaultPercentCompleteType>Duration</ActivityDefaultPercentCompleteType>`);
  p(`    <ActivityDefaultPricePerUnit>0</ActivityDefaultPricePerUnit>`);
  p(`    <ActivityIdBasedOnSelectedActivity>1</ActivityIdBasedOnSelectedActivity>`);
  p(`    <ActivityIdIncrement>10</ActivityIdIncrement>`);
  p(`    <ActivityIdPrefix>A</ActivityIdPrefix>`);
  p(`    <ActivityIdSuffix>1000</ActivityIdSuffix>`);
  p(`    <ActivityPercentCompleteBasedOnActivitySteps>0</ActivityPercentCompleteBasedOnActivitySteps>`);
  p(`    <AddActualToRemaining>0</AddActualToRemaining>`);
  p(`    <AddedBy>ADMIN</AddedBy>`);
  p(`    <AllowNegativeActualUnitsFlag>0</AllowNegativeActualUnitsFlag>`);
  p(`    <AllowStatusReview>0</AllowStatusReview>`);
  p(`    <AnnualDiscountRate ${NIL}/>`);
  p(`    <AnticipatedFinishDate ${NIL}/>`);
  p(`    <AnticipatedStartDate ${NIL}/>`);
  p(`    <AssignmentDefaultDrivingFlag>1</AssignmentDefaultDrivingFlag>`);
  p(`    <AssignmentDefaultRateType>Price / Unit</AssignmentDefaultRateType>`);
  p(`    <CheckOutStatus>0</CheckOutStatus>`);
  p(`    <CostQuantityRecalculateFlag>0</CostQuantityRecalculateFlag>`);
  p(`    <CriticalActivityFloatLimit>0</CriticalActivityFloatLimit>`);
  p(`    <CriticalActivityPathType>Critical Float</CriticalActivityPathType>`);
  p(`    <CurrentBaselineProjectObjectId ${NIL}/>`);
  p(`    <DataDate>${dataDateTime}</DataDate>`);
  p(`    <DateAdded>${exportDate}T00:00:00</DateAdded>`);
  p(`    <DefaultPriceTimeUnits>Hour</DefaultPriceTimeUnits>`);
  p(`    <DiscountApplicationPeriod ${NIL}/>`);
  p(`    <EarnedValueComputeType>Activity Percent Complete</EarnedValueComputeType>`);
  p(`    <EarnedValueETCComputeType>PF = 1 / (CPI * SPI)</EarnedValueETCComputeType>`);
  p(`    <EarnedValueETCUserValue>0.88</EarnedValueETCUserValue>`);
  p(`    <EarnedValueUserPercent>0.06</EarnedValueUserPercent>`);
  p(`    <EnableSummarization>1</EnableSummarization>`);
  p(`    <FinancialPeriodTemplateId>1</FinancialPeriodTemplateId>`);
  p(`    <FiscalYearStartMonth>1</FiscalYearStartMonth>`);
  p(`    <GUID>${genGuid(projObjId)}</GUID>`);
  p(`    <Id><![CDATA[ ${esc(projectId)} ]]></Id>`);
  p(`    <IndependentETCLaborUnits>0</IndependentETCLaborUnits>`);
  p(`    <IndependentETCTotalCost>0</IndependentETCTotalCost>`);
  p(`    <LastFinancialPeriodObjectId ${NIL}/>`);
  p(`    <LevelingPriority>10</LevelingPriority>`);
  p(`    <LinkActualToActualThisPeriod>1</LinkActualToActualThisPeriod>`);
  p(`    <LinkPercentCompleteWithActual>1</LinkPercentCompleteWithActual>`);
  p(`    <LinkPlannedAndAtCompletionFlag>1</LinkPlannedAndAtCompletionFlag>`);
  p(`    <MustFinishByDate ${NIL}/>`);
  p(`    <Name><![CDATA[ ${esc(projectName)} ]]></Name>`);
  p(`    <OBSObjectId>540</OBSObjectId>`);
  p(`    <ObjectId>${projObjId}</ObjectId>`);
  p(`    <OriginalBudget>0</OriginalBudget>`);
  p(`    <ParentEPSObjectId>62798</ParentEPSObjectId>`);
  p(`    <PlannedStartDate>${dataDateTime}</PlannedStartDate>`);
  p(`    <PrimaryResourcesCanMarkActivitiesAsCompleted>1</PrimaryResourcesCanMarkActivitiesAsCompleted>`);
  p(`    <ProjectForecastStartDate ${NIL}/>`);
  p(`    <ResetPlannedToRemainingFlag>0</ResetPlannedToRemainingFlag>`);
  p(`    <ResourceCanBeAssignedToSameActivityMoreThanOnce>1</ResourceCanBeAssignedToSameActivityMoreThanOnce>`);
  p(`    <ResourcesCanAssignThemselvesToActivities>1</ResourcesCanAssignThemselvesToActivities>`);
  p(`    <ScheduledFinishDate ${NIL}/>`);
  p(`    <Status>Active</Status>`);
  p(`    <StrategicPriority>500</StrategicPriority>`);
  p(`    <SummarizeToWBSLevel>2</SummarizeToWBSLevel>`);
  p(`    <SummaryLevel>Assignment Level</SummaryLevel>`);
  p(`    <UseProjectBaselineForEarnedValue>1</UseProjectBaselineForEarnedValue>`);
  p(`    <WBSCodeSeparator>.</WBSCodeSeparator>`);
  p(`    <WBSObjectId>${wbsObjId}</WBSObjectId>`);
  p(`    <WebSiteRootDirectory ${NIL}/>`);
  p(`    <WebSiteURL ${NIL}/>`);

  // ── WBS ───────────────────────────────────────────────────────────────────
  wbsList.forEach(wbs => {
    p(`    <WBS>`);
    p(`      <AnticipatedFinishDate ${NIL}/>`);
    p(`      <AnticipatedStartDate ${NIL}/>`);
    p(`      <Code>${esc(wbs.code)}</Code>`);
    p(`      <EarnedValueComputeType>Activity Percent Complete</EarnedValueComputeType>`);
    p(`      <EarnedValueETCComputeType>PF = 1 / (CPI * SPI)</EarnedValueETCComputeType>`);
    p(`      <EarnedValueETCUserValue>0.88</EarnedValueETCUserValue>`);
    p(`      <EarnedValueUserPercent>0.06</EarnedValueUserPercent>`);
    p(`      <GUID>${genGuid(wbs.objectId)}</GUID>`);
    p(`      <IndependentETCLaborUnits>0</IndependentETCLaborUnits>`);
    p(`      <IndependentETCTotalCost>0</IndependentETCTotalCost>`);
    p(`      <Name>${esc(wbs.name)}</Name>`);
    p(`      <OBSObjectId>540</OBSObjectId>`);
    p(`      <ObjectId>${wbs.objectId}</ObjectId>`);
    p(`      <OriginalBudget>0</OriginalBudget>`);
    p(`      <ParentObjectId ${NIL}/>`);
    p(`      <ProjectObjectId>${projObjId}</ProjectObjectId>`);
    p(`      <SequenceNumber>0</SequenceNumber>`);
    p(`      <Status>Active</Status>`);
    p(`      <WBSCategoryObjectId ${NIL}/>`);
    p(`    </WBS>`);
  });

  // ── Activities ────────────────────────────────────────────────────────────
  activities.forEach(a => {
    p(`    <Activity>`);
    p(`      <ActualDuration>0</ActualDuration>`);
    p(a.actFinish ? `      <ActualFinishDate>${a.actFinish}</ActualFinishDate>` : `      <ActualFinishDate ${NIL}/>`);
    p(`      <ActualLaborCost>0</ActualLaborCost>`);
    p(`      <ActualLaborUnits>0</ActualLaborUnits>`);
    p(`      <ActualNonLaborCost>0</ActualNonLaborCost>`);
    p(`      <ActualNonLaborUnits>0</ActualNonLaborUnits>`);
    p(a.actStart ? `      <ActualStartDate>${a.actStart}</ActualStartDate>` : `      <ActualStartDate ${NIL}/>`);
    p(`      <ActualThisPeriodLaborCost>0</ActualThisPeriodLaborCost>`);
    p(`      <ActualThisPeriodLaborUnits>0</ActualThisPeriodLaborUnits>`);
    p(`      <ActualThisPeriodNonLaborCost>0</ActualThisPeriodNonLaborCost>`);
    p(`      <ActualThisPeriodNonLaborUnits>0</ActualThisPeriodNonLaborUnits>`);
    p(`      <AtCompletionDuration>${a.dur}</AtCompletionDuration>`);
    p(`      <AtCompletionExpenseCost>0</AtCompletionExpenseCost>`);
    p(`      <AtCompletionLaborCost>0</AtCompletionLaborCost>`);
    p(`      <AtCompletionLaborUnits>0</AtCompletionLaborUnits>`);
    p(`      <AtCompletionNonLaborCost>0</AtCompletionNonLaborCost>`);
    p(`      <AtCompletionNonLaborUnits>0</AtCompletionNonLaborUnits>`);
    p(`      <AutoComputeActuals>${a.autoCompute === "Y" ? "1" : "0"}</AutoComputeActuals>`);
    p(`      <CalendarObjectId>${CAL_OBJ_ID}</CalendarObjectId>`);
    p(`      <DurationPercentComplete>${a.pct}</DurationPercentComplete>`);
    p(`      <DurationType>${esc(a.durType) || "Fixed Duration and Units"}</DurationType>`);
    p(`      <EstimatedWeight>1</EstimatedWeight>`);
    p(a.expFinishDt ? `      <ExpectedFinishDate>${a.expFinishDt}</ExpectedFinishDate>` : `      <ExpectedFinishDate ${NIL}/>`);
    p(a.extEarlyDt ? `      <ExternalEarlyStartDate>${a.extEarlyDt}</ExternalEarlyStartDate>` : `      <ExternalEarlyStartDate ${NIL}/>`);
    p(a.extLateDt ? `      <ExternalLateFinishDate>${a.extLateDt}</ExternalLateFinishDate>` : `      <ExternalLateFinishDate ${NIL}/>`);
    p(`      <Feedback />`);
    p(`      <FinishDate>${a.earlyFinishDt || a.finishDt || ""}</FinishDate>`);
    p(`      <GUID>${genGuid(a.objectId)}</GUID>`);
    p(`      <Id>${esc(a.id)}</Id>`);
    p(`      <IsNewFeedback>0</IsNewFeedback>`);
    p(`      <LevelingPriority>${esc(a.priorityType) || "Normal"}</LevelingPriority>`);
    p(`      <Name>${esc(a.name)}</Name>`);
    p(`      <NonLaborUnitsPercentComplete>0</NonLaborUnitsPercentComplete>`);
    p(`      <NotesToResources />`);
    p(`      <ObjectId>${a.objectId}</ObjectId>`);
    p(`      <PercentComplete>${a.pct}</PercentComplete>`);
    p(`      <PercentCompleteType>Duration</PercentCompleteType>`);
    p(`      <PhysicalPercentComplete>${a.pct}</PhysicalPercentComplete>`);
    p(`      <PlannedDuration>${a.dur}</PlannedDuration>`);
    p(`      <PlannedFinishDate>${a.plFinish || a.finishDt || ""}</PlannedFinishDate>`);
    p(`      <PlannedLaborCost>0</PlannedLaborCost>`);
    p(`      <PlannedLaborUnits>0</PlannedLaborUnits>`);
    p(`      <PlannedNonLaborCost>0</PlannedNonLaborCost>`);
    p(`      <PlannedNonLaborUnits>0</PlannedNonLaborUnits>`);
    p(`      <PlannedStartDate>${a.plStart || a.startDt || ""}</PlannedStartDate>`);
    p(a.constDate ? `      <PrimaryConstraintDate>${a.constDate}</PrimaryConstraintDate>` : `      <PrimaryConstraintDate ${NIL}/>`);
    p(`      <PrimaryConstraintType>${esc(a.constraintType) || ""}</PrimaryConstraintType>`);
    p(a.primRes ? `      <PrimaryResourceObjectId>${esc(a.primRes)}</PrimaryResourceObjectId>` : `      <PrimaryResourceObjectId ${NIL}/>`);
    p(`      <ProjectObjectId>${projObjId}</ProjectObjectId>`);
    p(`      <RemainingDuration>${a.remDurHrs}</RemainingDuration>`);
    p(`      <RemainingEarlyFinishDate>${a.earlyFinishDt || a.finishDt || ""}</RemainingEarlyFinishDate>`);
    p(`      <RemainingEarlyStartDate>${a.earlyStartDt || a.startDt || ""}</RemainingEarlyStartDate>`);
    p(`      <RemainingLaborCost>0</RemainingLaborCost>`);
    p(`      <RemainingLaborUnits>0</RemainingLaborUnits>`);
    p(`      <RemainingLateFinishDate>${a.lateFinishDt || a.finishDt || ""}</RemainingLateFinishDate>`);
    p(`      <RemainingLateStartDate>${a.lateStartDt || a.startDt || ""}</RemainingLateStartDate>`);
    p(`      <RemainingNonLaborCost>0</RemainingNonLaborCost>`);
    p(`      <RemainingNonLaborUnits>0</RemainingNonLaborUnits>`);
    p(a.resDate ? `      <ResumeDate>${a.resDate}</ResumeDate>` : `      <ResumeDate ${NIL}/>`);
    p(`      <ReviewRequired>0</ReviewRequired>`);
    p(`      <ScopePercentComplete>0</ScopePercentComplete>`);
    p(a.constDate2 ? `      <SecondaryConstraintDate>${a.constDate2}</SecondaryConstraintDate>` : `      <SecondaryConstraintDate ${NIL}/>`);
    p(`      <SecondaryConstraintType>${esc(a.constraintType2) || ""}</SecondaryConstraintType>`);
    p(`      <StartDate>${a.earlyStartDt || a.startDt || ""}</StartDate>`);
    p(`      <Status>${esc(a.statusCode || a.status)}</Status>`);
    p(a.suspDate ? `      <SuspendDate>${a.suspDate}</SuspendDate>` : `      <SuspendDate ${NIL}/>`);
    p(`      <Type>Task Dependent</Type>`);
    p(`      <UnitsPercentComplete>0</UnitsPercentComplete>`);
    p(a.wbsObjId ? `      <WBSObjectId>${a.wbsObjId}</WBSObjectId>` : `      <WBSObjectId ${NIL}/>`);
    p(`    </Activity>`);
  });

  // ── Relationships ─────────────────────────────────────────────────────────
  relationships.forEach(r => {
    p(`    <Relationship>`);
    p(`      <Comments ${NIL}/>`);
    p(`      <Lag>${r.lag}</Lag>`);
    p(`      <ObjectId>${r.objectId}</ObjectId>`);
    p(`      <PredecessorActivityObjectId>${r.predObjId}</PredecessorActivityObjectId>`);
    p(`      <PredecessorProjectObjectId>${projObjId}</PredecessorProjectObjectId>`);
    p(`      <SuccessorActivityObjectId>${r.succObjId}</SuccessorActivityObjectId>`);
    p(`      <SuccessorProjectObjectId>${projObjId}</SuccessorProjectObjectId>`);
    p(`      <Type>${esc(r.type)}</Type>`);
    p(`    </Relationship>`);
  });

  // ── ScheduleOptions ───────────────────────────────────────────────────────
  p(`    <ScheduleOptions>`);
  p(`      <CalculateFloatBasedOnFinishDate>1</CalculateFloatBasedOnFinishDate>`);
  p(`      <ComputeTotalFloatType>Finish Float = Late Finish - Early Finish</ComputeTotalFloatType>`);
  p(`      <CriticalActivityFloatThreshold>0</CriticalActivityFloatThreshold>`);
  p(`      <CriticalActivityPathType>Critical Float</CriticalActivityPathType>`);
  p(`      <ExternalProjectPriorityLimit>5</ExternalProjectPriorityLimit>`);
  p(`      <IgnoreOtherProjectRelationships>0</IgnoreOtherProjectRelationships>`);
  p(`      <IncludeExternalResAss>0</IncludeExternalResAss>`);
  p(`      <LevelAllResources>1</LevelAllResources>`);
  p(`      <LevelWithinFloat>0</LevelWithinFloat>`);
  p(`      <MakeOpenEndedActivitiesCritical>0</MakeOpenEndedActivitiesCritical>`);
  p(`      <MaximumMultipleFloatPaths>10</MaximumMultipleFloatPaths>`);
  p(`      <MinFloatToPreserve>1</MinFloatToPreserve>`);
  p(`      <MultipleFloatPathsEnabled>0</MultipleFloatPathsEnabled>`);
  p(`      <MultipleFloatPathsEndingActivityObjectId />`);
  p(`      <MultipleFloatPathsUseTotalFloat>1</MultipleFloatPathsUseTotalFloat>`);
  p(`      <OutOfSequenceScheduleType>Retained Logic</OutOfSequenceScheduleType>`);
  p(`      <OverAllocationPercentage>25</OverAllocationPercentage>`);
  p(`      <PreserveScheduledEarlyAndLateDates>1</PreserveScheduledEarlyAndLateDates>`);
  p(`      <PriorityList>(0||priority_type(sort_type|ASC)())</PriorityList>`);
  p(`      <ProjectObjectId>${projObjId}</ProjectObjectId>`);
  p(`      <RelationshipLagCalendar>Predecessor Activity Calendar</RelationshipLagCalendar>`);
  p(`      <ResourceList />`);
  p(`      <StartToStartLagCalculationType>1</StartToStartLagCalculationType>`);
  p(`      <UseExpectedFinishDates>1</UseExpectedFinishDates>`);
  p(`    </ScheduleOptions>`);

  p(`  </Project>`);
  p(`</APIBusinessObjects>`);

  return L.join("\n");
}

function relTypeLabel(code) {
  const map = { FS: "Finish to Start", SS: "Start to Start", FF: "Finish to Finish", SF: "Start to Finish" };
  return map[String(code).toUpperCase()] || "Finish to Start";
}