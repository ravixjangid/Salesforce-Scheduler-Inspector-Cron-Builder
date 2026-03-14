document.addEventListener("DOMContentLoaded", initCronMaker);

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const WEEKDAY_NAMES = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday"
};

const WEEKDAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

let generatedSummary = {
  frequency: "Hourly",
  runTime: "Every 1 hour at :00",
  detail: "Every 1 hour at minute 00, starting at 00:00",
  preview: "00:00, 01:00, 02:00, 03:00"
};
let generatedNextRuns = [];
let generatedCrons = ["0 0 0/1 * * ? *"];

function initCronMaker() {
  applyPageMode();
  populateIntervalSelect("hourly");
  populateSelect("hour", 0, 23);
  populateSelect("hour2", 0, 23);
  populateSelect("hour3", 0, 23);
  populateSelect("minute", 0, 59);
  populateSelect("dayOfMonth", 1, 31);
  populateSelect("dayOfMonth2", 1, 31);
  populateSelect("dayOfMonth3", 1, 31);
  populateWeekdaySelect("weekday");
  populateWeekdaySelect("weekday2");
  populateWeekdaySelect("weekday3");
  populateMonths();

  resetBuilderInputs("hourly");

  document.getElementById("frequency").addEventListener("change", handleFrequencyChange);
  document.getElementById("interval").addEventListener("change", handleManualChange);
  document.getElementById("hour").addEventListener("change", handleManualChange);
  document.getElementById("hour2").addEventListener("change", handleManualChange);
  document.getElementById("hour3").addEventListener("change", handleManualChange);
  document.getElementById("minute").addEventListener("change", handleManualChange);
  document.getElementById("runCount").addEventListener("change", handleManualChange);
  document.getElementById("dayOfMonth").addEventListener("change", handleManualChange);
  document.getElementById("dayOfMonth2").addEventListener("change", handleManualChange);
  document.getElementById("dayOfMonth3").addEventListener("change", handleManualChange);
  document.getElementById("month").addEventListener("change", handleManualChange);
  document.getElementById("month2").addEventListener("change", handleManualChange);
  document.getElementById("month3").addEventListener("change", handleManualChange);
  document.getElementById("weekday").addEventListener("change", handleManualChange);
  document.getElementById("weekday2").addEventListener("change", handleManualChange);
  document.getElementById("weekday3").addEventListener("change", handleManualChange);

  document.querySelectorAll(".preset-chip").forEach(button => {
    button.addEventListener("click", () => {
      applyPreset(button.dataset.preset);
    });
  });

  document.getElementById("explainCronInput").addEventListener("input", updateCronExplanation);
  document.getElementById("useGeneratedCronBtn").addEventListener("click", useGeneratedCronForExplanation);

  document.getElementById("copyCronBtn").addEventListener("click", () => {
    copyCron().catch(() => {
      showToast("Copy failed. Please copy manually.", true);
    });
  });
  document.getElementById("resetCronBtn").addEventListener("click", resetCronMaker);
  bindCronToolTabs();

  updateCronState();
  updateCronExplanation();
}

function handleManualChange() {
  setActivePreset("");
  updateCronState();
}

function handleFrequencyChange() {
  setActivePreset("");
  resetBuilderInputs(document.getElementById("frequency").value);
  updateCronState();
}

function bindCronToolTabs() {
  document.querySelectorAll(".tool-tab").forEach(button => {
    button.addEventListener("click", () => {
      setCronToolView(button.dataset.view);
    });
  });
}

function setCronToolView(view) {
  const isExplainer = view === "explainer";
  const builderTab = document.getElementById("builderTab");
  const explainerTab = document.getElementById("explainerTab");
  const builderView = document.getElementById("builderView");
  const explainerView = document.getElementById("explainerView");

  if (!builderTab || !explainerTab || !builderView || !explainerView) {
    return;
  }

  builderTab.classList.toggle("is-active", !isExplainer);
  explainerTab.classList.toggle("is-active", isExplainer);
  builderTab.setAttribute("aria-selected", String(!isExplainer));
  explainerTab.setAttribute("aria-selected", String(isExplainer));
  builderView.classList.toggle("is-active", !isExplainer);
  explainerView.classList.toggle("is-active", isExplainer);
  builderView.hidden = isExplainer;
  explainerView.hidden = !isExplainer;

  if (isExplainer) {
    updateCronExplanation();
    document.getElementById("explainCronInput")?.focus();
    return;
  }

  updateCronState();
}

function resetBuilderInputs(frequency = "hourly") {
  document.getElementById("frequency").value = frequency;
  populateIntervalSelect(frequency);

  [
    "interval",
    "hour",
    "hour2",
    "hour3",
    "minute",
    "runCount",
    "dayOfMonth",
    "dayOfMonth2",
    "dayOfMonth3",
    "month",
    "month2",
    "month3",
    "weekday",
    "weekday2",
    "weekday3"
  ].forEach(resetSelectToFirstOption);
}

function resetSelectToFirstOption(id) {
  const select = document.getElementById(id);
  const optionCount = select?.options?.length ?? select?.children?.length ?? 0;

  if (!select || optionCount === 0) {
    return;
  }

  select.selectedIndex = 0;

  if (!select.options && select.children && select.children[0]) {
    select.value = select.children[0].value;
  }
}

function applyPageMode() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode") === "generic" ? "generic" : "salesforce";

  const eyebrow = document.getElementById("heroEyebrow");
  const heroText = document.getElementById("heroText");
  const summaryIntro = document.getElementById("summaryIntro");
  const summaryTypeLabel = document.getElementById("summaryTypeLabel");
  const summaryTypeValue = document.getElementById("summaryTypeValue");
  const tipType = document.getElementById("tipType");
  const tipTimezone = document.getElementById("tipTimezone");

  if (mode === "salesforce") {
    if (eyebrow) {
      eyebrow.textContent = "Salesforce Scheduler Inspector & Cron Builder";
    }

    if (heroText) {
      heroText.textContent = "Build Salesforce Quartz cron expressions for Scheduled Apex jobs.";
    }

    if (summaryIntro) {
      summaryIntro.textContent = "Review before using in Salesforce.";
    }

    if (summaryTypeLabel) {
      summaryTypeLabel.textContent = "Submitted Type";
    }

    if (summaryTypeValue) {
      summaryTypeValue.textContent = "Scheduled Apex";
    }

    if (tipType) {
      tipType.textContent = "Salesforce Scheduled Apex uses Quartz cron format.";
    }

    if (tipTimezone) {
      tipTimezone.textContent = "Adjust timezone in Salesforce if your org runs in a different zone.";
    }
  }
}

function populateSelect(id, start, end) {
  const select = document.getElementById(id);

  for (let value = start; value <= end; value += 1) {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = String(value).padStart(2, "0");
    select.appendChild(option);
  }
}

function populateMonths() {
  ["month", "month2", "month3"].forEach(id => {
    const monthSelect = document.getElementById(id);
    MONTH_NAMES.forEach((name, index) => {
      const option = document.createElement("option");
      option.value = String(index + 1);
      option.textContent = name;
      monthSelect.appendChild(option);
    });
  });
}

function populateWeekdaySelect(id) {
  const select = document.getElementById(id);

  WEEKDAY_ORDER.forEach(dayCode => {
    const option = document.createElement("option");
    option.value = dayCode;
    option.textContent = WEEKDAY_NAMES[dayCode];
    select.appendChild(option);
  });
}

function populateIntervalSelect(frequency) {
  const intervalSelect = document.getElementById("interval");
  const options = [
    { value: "1", label: "Every 1 hour" },
    { value: "2", label: "Every 2 hours" },
    { value: "3", label: "Every 3 hours" },
    { value: "4", label: "Every 4 hours" },
    { value: "6", label: "Every 6 hours" },
    { value: "12", label: "Every 12 hours" }
  ];

  const previousValue = intervalSelect.value || "1";
  intervalSelect.innerHTML = "";

  options.forEach(optionData => {
    const option = document.createElement("option");
    option.value = optionData.value;
    option.textContent = optionData.label;
    intervalSelect.appendChild(option);
  });

  intervalSelect.value = options.some(option => option.value === previousValue)
    ? previousValue
    : options[0].value;
}

function updateCronState() {
  const frequency = document.getElementById("frequency").value;
  const intervalField = document.getElementById("intervalField");
  const intervalLabel = document.getElementById("intervalLabel");
  const intervalSelect = document.getElementById("interval");
  const runCountLabel = document.getElementById("runCountLabel");
  const hour = Number(document.getElementById("hour").value);
  const hour2 = Number(document.getElementById("hour2").value);
  const hour3 = Number(document.getElementById("hour3").value);
  const minute = Number(document.getElementById("minute").value);
  const runCount = Number(document.getElementById("runCount").value);
  const dayOfMonth = Number(document.getElementById("dayOfMonth").value);
  const dayOfMonth2 = Number(document.getElementById("dayOfMonth2").value);
  const dayOfMonth3 = Number(document.getElementById("dayOfMonth3").value);
  const month = Number(document.getElementById("month").value);
  const month2 = Number(document.getElementById("month2").value);
  const month3 = Number(document.getElementById("month3").value);

  const weekdayPanel = document.getElementById("weekdayPanel");
  const weekday2Field = document.getElementById("weekday2Field");
  const weekday3Field = document.getElementById("weekday3Field");
  const dayOfMonthField = document.getElementById("dayOfMonthField");
  const dayOfMonth2Field = document.getElementById("dayOfMonth2Field");
  const dayOfMonth3Field = document.getElementById("dayOfMonth3Field");
  const monthField = document.getElementById("monthField");
  const month2Field = document.getElementById("month2Field");
  const month3Field = document.getElementById("month3Field");
  const hourField = document.getElementById("hourField");
  const hour2Field = document.getElementById("hour2Field");
  const hour3Field = document.getElementById("hour3Field");
  const minuteField = document.getElementById("minuteField");
  const runCountField = document.getElementById("runCountField");

  populateIntervalSelect(frequency);

  const interval = Number(intervalSelect.value);
  const showDailyRuns = frequency === "daily";
  const showWeeklyRuns = frequency === "weekly";
  const showMonthlyRuns = frequency === "monthly";
  const showYearlyRuns = frequency === "yearly";
  const selectedHours = showDailyRuns ? buildSelectedHours(runCount, hour, hour2, hour3) : [hour];
  const selectedWeekdays = showWeeklyRuns ? getSelectedWeekdays(runCount) : [];
  const selectedMonthDays = showMonthlyRuns ? buildSelectedNumberValues(runCount, dayOfMonth, dayOfMonth2, dayOfMonth3) : [dayOfMonth];
  const selectedMonths = showYearlyRuns ? buildSelectedNumberValues(runCount, month, month2, month3) : [month];

  weekdayPanel.style.display = frequency === "weekly" ? "block" : "none";
  intervalField.style.display = frequency === "hourly" ? "grid" : "none";
  dayOfMonthField.style.display = ["monthly", "yearly"].includes(frequency) ? "grid" : "none";
  dayOfMonth2Field.style.display = showMonthlyRuns && runCount >= 2 ? "grid" : "none";
  dayOfMonth3Field.style.display = showMonthlyRuns && runCount >= 3 ? "grid" : "none";
  monthField.style.display = frequency === "yearly" ? "grid" : "none";
  month2Field.style.display = showYearlyRuns && runCount >= 2 ? "grid" : "none";
  month3Field.style.display = showYearlyRuns && runCount >= 3 ? "grid" : "none";
  hourField.style.display = ["daily", "weekly", "monthly", "yearly"].includes(frequency) ? "grid" : "none";
  runCountField.style.display = ["daily", "weekly", "monthly", "yearly"].includes(frequency) ? "grid" : "none";
  hour2Field.style.display = showDailyRuns && runCount >= 2 ? "grid" : "none";
  hour3Field.style.display = showDailyRuns && runCount >= 3 ? "grid" : "none";
  weekday2Field.style.display = showWeeklyRuns && runCount >= 2 ? "grid" : "none";
  weekday3Field.style.display = showWeeklyRuns && runCount >= 3 ? "grid" : "none";
  minuteField.style.display = "grid";
  intervalLabel.textContent = "Hour Interval";
  runCountLabel.textContent = getRunCountLabel(frequency);

  let cron = "";
  let detail = "";
  let summaryTime = `${pad(hour)}:${pad(minute)}`;
  let preview = "";
  let models = [];

  if (frequency === "hourly") {
    cron = `0 ${minute} 0/${interval} * * ? *`;
    detail = `Every ${interval} hour${interval === 1 ? "" : "s"} at minute ${pad(minute)}, starting at 00:${pad(minute)}`;
    summaryTime = `Every ${interval} hour${interval === 1 ? "" : "s"} at :${pad(minute)}`;
    preview = buildHourlyPreview(interval, minute);
    models = [{
      frequency: "hourly",
      interval,
      hour: 0,
      minute,
      dayOfMonth: 1,
      month: 1,
      weekdays: []
    }];
  }
  else if (frequency === "daily") {
    cron = `0 ${minute} ${selectedHours.join(",")} * * ? *`;
    detail = `Every day at ${formatHourSummary(selectedHours, minute)}`;
    summaryTime = formatHourSummary(selectedHours, minute);
    preview = cron;
    models = selectedHours.map(selectedHour => ({
      frequency: "daily",
      interval: 1,
      hour: selectedHour,
      minute,
      dayOfMonth: 1,
      month: 1,
      weekdays: []
    }));
  }
  else if (frequency === "weekly") {
    const days = selectedWeekdays.length > 0 ? selectedWeekdays.join(",") : "?";
    cron = selectedWeekdays.length > 0 ? `0 ${minute} ${hour} ? * ${days} *` : "Invalid schedule";
    detail = selectedWeekdays.length > 0
      ? `Every ${formatWeekdays(selectedWeekdays)} at ${pad(hour)}:${pad(minute)}`
      : "Select at least one weekday.";
    summaryTime = `${pad(hour)}:${pad(minute)}`;
    preview = selectedWeekdays.length > 0 ? cron : "-";
    models = selectedWeekdays.length > 0
      ? selectedWeekdays.map(selectedWeekday => ({
        frequency: "weekly",
        interval: 1,
        hour,
        minute,
        dayOfMonth: 1,
        month: 1,
        weekdays: [selectedWeekday]
      }))
      : [];
  }
  else if (frequency === "monthly") {
    cron = `0 ${minute} ${hour} ${selectedMonthDays.join(",")} * ? *`;
    detail = `Day ${formatNumberList(selectedMonthDays)} of every month at ${pad(hour)}:${pad(minute)}`;
    summaryTime = `${pad(hour)}:${pad(minute)}`;
    preview = cron;
    models = selectedMonthDays.map(selectedDay => ({
      frequency: "monthly",
      interval: 1,
      hour,
      minute,
      dayOfMonth: selectedDay,
      month: 1,
      weekdays: []
    }));
  }
  else {
    cron = `0 ${minute} ${hour} ${dayOfMonth} ${selectedMonths.join(",")} ? *`;
    detail = `${formatMonthLabels(selectedMonths)} ${pad(dayOfMonth)} at ${pad(hour)}:${pad(minute)} every year`;
    summaryTime = `${pad(hour)}:${pad(minute)}`;
    preview = cron;
    models = selectedMonths.map(selectedMonth => ({
      frequency: "yearly",
      interval: 1,
      hour,
      minute,
      dayOfMonth,
      month: selectedMonth,
      weekdays: []
    }));
  }

  const validation = validateSchedule({
    frequency,
    interval,
    hour,
    minute,
    dayOfMonth,
    month,
    selectedWeekdays,
    selectedMonthDays,
    selectedMonths,
    runCount,
    selectedHours
  });
  const nextRuns = validation.isValid ? getCombinedNextRuns(models, 5) : [];

  if (!validation.isValid) {
    cron = "Invalid schedule";
  }

  generatedCrons = [cron];
  document.getElementById("cronOutput").textContent = cron;
  generatedSummary = {
    frequency: formatFrequency(frequency),
    runTime: summaryTime,
    detail,
    preview
  };
  generatedNextRuns = nextRuns;
  applySummary(generatedSummary);
  renderNextRuns(generatedNextRuns);
  document.getElementById("copyCronBtn").disabled = !validation.isValid;

  renderValidation(validation);
}

function getSelectedWeekdays(runCount) {
  return buildSelectedValueList(runCount, [
    document.getElementById("weekday").value,
    document.getElementById("weekday2").value,
    document.getElementById("weekday3").value
  ], compareWeekdays);
}

function buildSelectedHours(runCount, firstHour, secondHour, thirdHour) {
  return buildSelectedValueList(runCount, [firstHour, secondHour, thirdHour], (left, right) => left - right);
}

function buildSelectedNumberValues(runCount, firstValue, secondValue, thirdValue) {
  return buildSelectedValueList(runCount, [firstValue, secondValue, thirdValue], (left, right) => left - right);
}

function buildSelectedValueList(runCount, values, sortFn) {
  return [...new Set(values.slice(0, runCount))].sort(sortFn);
}

function compareWeekdays(left, right) {
  return WEEKDAY_ORDER.indexOf(left) - WEEKDAY_ORDER.indexOf(right);
}

function getRunCountLabel(frequency) {
  const labels = {
    daily: "Runs Per Day",
    weekly: "Days Per Week",
    monthly: "Days Per Month",
    yearly: "Months Per Year"
  };

  return labels[frequency] || "Runs";
}

function formatNumberList(values) {
  return values.map(value => pad(value)).join(", ");
}

function formatMonthLabels(values) {
  return values.map(getMonthLabel).join(", ");
}

function formatHourSummary(hours, minute) {
  return hours.map(hour => `${pad(hour)}:${pad(minute)}`).join(", ");
}

function parseCronHours(value) {
  const tokens = String(value)
    .split(",")
    .map(token => token.trim())
    .filter(Boolean);

  if (!tokens.length || !tokens.every(token => isNumber(token) && Number(token) >= 0 && Number(token) <= 23)) {
    return null;
  }

  return [...new Set(tokens.map(Number))].sort((left, right) => left - right);
}

function parseCronNumberList(value, minimum, maximum) {
  const tokens = String(value)
    .split(",")
    .map(token => token.trim())
    .filter(Boolean);

  if (!tokens.length || !tokens.every(token => isNumber(token) && Number(token) >= minimum && Number(token) <= maximum)) {
    return null;
  }

  return [...new Set(tokens.map(Number))].sort((left, right) => left - right);
}

function buildModelsForHours(frequency, hours, minute, overrides = {}) {
  if (!Array.isArray(hours) || hours.length === 0) {
    return [];
  }

  return hours.map(hour => ({
    frequency,
    interval: overrides.interval ?? 1,
    hour,
    minute,
    dayOfMonth: overrides.dayOfMonth ?? 1,
    month: overrides.month ?? 1,
    weekdays: Array.isArray(overrides.weekdays) ? [...overrides.weekdays] : []
  }));
}

function getCombinedNextRuns(models, count) {
  if (!models.length) {
    return [];
  }

  const candidates = models.flatMap(model => getNextRuns(model, count * 2));
  return [...new Set(candidates.map(item => item.getTime()))]
    .sort((left, right) => left - right)
    .slice(0, count)
    .map(value => new Date(value));
}

function formatWeekdays(days) {
  return days.map(day => WEEKDAY_NAMES[day] || day).join(", ");
}

function buildMinutePreview(intervalValue) {
  const interval = Number(intervalValue);
  const previewTimes = [];

  for (let index = 0; index < 4; index += 1) {
    const totalMinutes = index * interval;
    previewTimes.push(`${pad(Math.floor(totalMinutes / 60))}:${pad(totalMinutes % 60)}`);
  }

  return previewTimes.join(", ");
}

function buildHourlyPreview(intervalValue, minuteValue) {
  const interval = Number(intervalValue);
  const minute = Number(minuteValue);
  const previewTimes = [];
  const previewCount = Math.min(4, Math.max(1, Math.floor(24 / interval)));

  for (let index = 0; index < previewCount; index += 1) {
    previewTimes.push(`${pad((index * interval) % 24)}:${pad(minute)}`);
  }

  return previewTimes.join(", ");
}

function buildWeeklyPreview(days, hours, minute) {
  const dayText = Array.isArray(days) ? formatWeekdays(days) : formatCronWeekdays(days);
  const hourValues = Array.isArray(hours) ? hours.map(Number) : parseCronHours(hours) || [Number(hours)];
  return `${dayText} at ${formatHourSummary(hourValues, Number(minute))}`;
}

function applyPreset(preset) {
  resetBuilderInputs("hourly");

  if (preset === "hourly-top") {
    document.getElementById("frequency").value = "hourly";
    populateIntervalSelect("hourly");
    document.getElementById("interval").value = "1";
    document.getElementById("minute").value = "0";
  }
  else if (preset === "weekdays-morning") {
    document.getElementById("frequency").value = "weekly";
    document.getElementById("runCount").value = "3";
    document.getElementById("hour").value = "9";
    document.getElementById("minute").value = "0";
    setWeekdays(["MON", "WED", "FRI"]);
  }
  else if (preset === "month-start") {
    document.getElementById("frequency").value = "monthly";
    document.getElementById("dayOfMonth").value = "1";
    document.getElementById("hour").value = "8";
    document.getElementById("minute").value = "0";
  }
  else if (preset === "year-start") {
    document.getElementById("frequency").value = "yearly";
    document.getElementById("month").value = "1";
    document.getElementById("dayOfMonth").value = "1";
    document.getElementById("hour").value = "9";
    document.getElementById("minute").value = "0";
  }

  setActivePreset(preset);
  updateCronState();
}

function useGeneratedCronForExplanation() {
  const generatedCron = generatedCrons[0] || document.getElementById("cronOutput").textContent.split(/\r?\n/)[0] || "";
  const input = document.getElementById("explainCronInput");

  if (!input) {
    return;
  }

  input.value = generatedCron;
  updateCronExplanation();
}

function validateSchedule(model) {
  const issues = [];

  if (model.frequency === "daily" && model.selectedHours.length === 0) {
    issues.push({
      type: "error",
      title: "Run Time Required",
      message: "Select at least one run time for this schedule."
    });
  }

  if (model.frequency === "daily" && model.runCount !== model.selectedHours.length) {
    issues.push({
      type: "error",
      title: "Duplicate Run Time",
      message: "Each run time should use a different hour."
    });
  }

  if (model.frequency === "weekly" && model.selectedWeekdays.length === 0) {
    issues.push({
      type: "error",
      title: "Weekday Required",
      message: "Select at least one weekday for a weekly schedule."
    });
  }

  if (model.frequency === "weekly" && model.runCount !== model.selectedWeekdays.length) {
    issues.push({
      type: "error",
      title: "Duplicate Weekday",
      message: "Each weekly run should use a different weekday."
    });
  }

  if (model.frequency === "monthly" && model.runCount !== model.selectedMonthDays.length) {
    issues.push({
      type: "error",
      title: "Duplicate Day",
      message: "Each monthly run should use a different day of the month."
    });
  }

  if (model.frequency === "monthly" && model.selectedMonthDays.some(day => day > 28)) {
    issues.push({
      type: "warning",
      title: "Month-End Schedule",
      message: `Day ${formatNumberList(model.selectedMonthDays.filter(day => day > 28))} will skip shorter months.`
    });
  }

  if (model.frequency === "yearly" && model.runCount !== model.selectedMonths.length) {
    issues.push({
      type: "error",
      title: "Duplicate Month",
      message: "Each yearly run should use a different month."
    });
  }

  if (model.frequency === "yearly") {
    const invalidMonths = model.selectedMonths.filter(selectedMonth => model.dayOfMonth > getMaxDayForMonth(selectedMonth, 2024));
    const leapOnlyMonths = model.selectedMonths.filter(selectedMonth => selectedMonth === 2 && model.dayOfMonth === 29);

    if (invalidMonths.length > 0) {
      issues.push({
        type: "error",
        title: "Invalid Date",
        message: `${formatMonthLabels(invalidMonths)} does not have ${pad(model.dayOfMonth)} days.`
      });
    }
    else if (leapOnlyMonths.length > 0) {
      issues.push({
        type: "warning",
        title: "Leap Year Schedule",
        message: "February 29 will only run during leap years."
      });
    }
  }

  if (issues.some(issue => issue.type === "error")) {
    return {
      isValid: false,
      tone: "error",
      title: issues.find(issue => issue.type === "error").title,
      message: issues.find(issue => issue.type === "error").message
    };
  }

  if (issues.length > 0) {
    return {
      isValid: true,
      tone: "warning",
      title: issues[0].title,
      message: issues[0].message
    };
  }

  return {
    isValid: true,
    tone: "success",
    title: "Valid Schedule",
    message: "Ready to copy and review upcoming runs."
  };
}

function renderValidation(validation) {
  const banner = document.getElementById("validationBanner");
  const title = document.getElementById("validationTitle");
  const message = document.getElementById("validationMessage");

  if (!banner || !title || !message) {
    return;
  }

  banner.classList.toggle("is-error", validation.tone === "error");
  banner.classList.toggle("is-warning", validation.tone === "warning");
  title.textContent = validation.title;
  message.textContent = validation.message;
}

function renderNextRuns(nextRuns) {
  const list = document.getElementById("nextRunsList");

  if (!list) {
    return;
  }

  list.innerHTML = "";

  if (nextRuns.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No upcoming runs until the schedule is valid.";
    list.appendChild(item);
    return;
  }

  nextRuns.forEach(run => {
    const item = document.createElement("li");
    item.textContent = formatPreviewDate(run);
    list.appendChild(item);
  });
}

function updateCronExplanation() {
  const input = document.getElementById("explainCronInput");

  if (!input) {
    return;
  }

  const cron = String(input.value || "").trim();

  if (!cron) {
    applySummary(generatedSummary);
    renderNextRuns(generatedNextRuns);
    return;
  }

  const summary = summarizeCronExpression(cron);

  if (!summary.valid) {
    applySummary({
      frequency: "Unsupported",
      runTime: "-",
      detail: summary.message,
      preview: cron
    });
    renderNextRuns([]);
    return;
  }

  applySummary({
    frequency: summary.frequency,
    runTime: summary.runTime,
    detail: summary.detail,
    preview: summary.preview
  });
  renderNextRuns(summary.nextRuns || []);
}

async function copyCron() {
  const cron = generatedCrons.join("\n");
  const button = document.getElementById("copyCronBtn");
  const originalText = button.textContent;

  try {
    await writeToClipboard(cron);
    button.textContent = "Copied";
    showToast("Cron copied");
  }
  catch (error) {
    button.textContent = "Copy Failed";
    showToast("Copy failed. Please copy manually.", true);
  }

  window.setTimeout(() => {
    button.textContent = originalText;
  }, 1200);
}

function resetCronMaker() {
  setActivePreset("");
  resetBuilderInputs("hourly");
  updateCronState();
}

function getNextRuns(model, count) {
  const runs = [];
  let cursor = new Date();

  while (runs.length < count) {
    const nextRun = getNextRunAfter(cursor, model);

    if (!nextRun) {
      break;
    }

    runs.push(nextRun);
    cursor = new Date(nextRun.getTime() + 1000);
  }

  return runs;
}

function explainCronExpression(cron) {
  const parts = cron.trim().split(/\s+/);

  if (parts.length < 6 || parts.length > 7) {
    return {
      valid: false,
      title: "Cron format not supported",
      message: "Use a Quartz cron with 6 or 7 fields, for example: 0 0/15 * * * ? *"
    };
  }

  const [seconds, minutes, hours, dayOfMonth, month, dayOfWeek, year = "*"] = parts;
  const minuteValue = isNumber(minutes) ? Number(minutes) : null;
  const hourValues = parseCronHours(hours);

  if (seconds !== "0") {
    return {
      valid: false,
      title: "Unsupported seconds field",
      message: "This explainer currently supports Quartz cron values that run at second 0."
    };
  }

  const timePhrase = describeTime(minutes, hours);
  const schedulePhrase = describeSchedule(dayOfMonth, month, dayOfWeek, year);

  if (!timePhrase || !schedulePhrase) {
    return {
      valid: false,
      title: "Cron pattern not recognized",
      message: "This explainer currently supports common Salesforce patterns: minute, hourly, daily, weekly, monthly, and yearly."
    };
  }

  return {
    valid: true,
    title: "Cron Summary",
    message: `${schedulePhrase} ${timePhrase}.`
  };
}

function summarizeCronExpression(cron) {
  const parts = cron.trim().split(/\s+/);

  if (parts.length < 6 || parts.length > 7) {
    return {
      valid: false,
      message: "Use a Quartz cron with 6 or 7 fields, for example: 0 0/15 * * * ? *"
    };
  }

  const [seconds, minutes, hours, dayOfMonth, month, dayOfWeek, year = "*"] = parts;
  const minuteValue = isNumber(minutes) ? Number(minutes) : null;
  const hourValues = parseCronHours(hours);
  const dayValues = parseCronNumberList(dayOfMonth, 1, 31);
  const monthValues = parseCronNumberList(month, 1, 12);

  if (seconds !== "0") {
    return {
      valid: false,
      message: "Only Quartz cron values that run at second 0 are supported here."
    };
  }

  if ((hours === "*" || hours === "*/1") && /^0\/\d+$/.test(minutes)) {
    const interval = minutes.split("/")[1];

    return {
      valid: true,
      frequency: "Every Minute",
      runTime: `Every ${interval} minute${interval === "1" ? "" : "s"}`,
      detail: `Every ${interval} minute${interval === "1" ? "" : "s"}, starting at 00:00`,
      preview: buildMinutePreview(interval),
      nextRuns: getNextRuns({
        frequency: "every-minute",
        interval: Number(interval),
        hour: 0,
        minute: 0,
        dayOfMonth: 1,
        month: 1,
        weekdays: []
      }, 5)
    };
  }

  if (/^0\/\d+$/.test(hours) && isNumber(minutes)) {
    const interval = hours.split("/")[1];

    return {
      valid: true,
      frequency: "Hourly",
      runTime: `Every ${interval} hour${interval === "1" ? "" : "s"} at :${pad(minutes)}`,
      detail: `Every ${interval} hour${interval === "1" ? "" : "s"} at minute ${pad(minutes)}`,
      preview: buildHourlyPreview(interval, minutes),
      nextRuns: getNextRuns({
        frequency: "hourly",
        interval: Number(interval),
        hour: 0,
        minute: Number(minutes),
        dayOfMonth: 1,
        month: 1,
        weekdays: []
      }, 5)
    };
  }

  if (dayOfMonth === "*" && month === "*" && dayOfWeek === "?" && hourValues && minuteValue !== null) {
    const runTime = formatHourSummary(hourValues, minuteValue);

    return {
      valid: true,
      frequency: "Daily",
      runTime,
      detail: `Every day at ${runTime}`,
      preview: `Every day at ${runTime}`,
      nextRuns: getCombinedNextRuns(buildModelsForHours("daily", hourValues, minuteValue), 5)
    };
  }

  if (dayOfMonth === "?" && isWeekdayField(dayOfWeek) && month === "*" && hourValues && minuteValue !== null) {
    const weekdays = dayOfWeek.split(",");
    const runTime = formatHourSummary(hourValues, minuteValue);

    return {
      valid: true,
      frequency: "Weekly",
      runTime,
      detail: `Every ${formatCronWeekdays(dayOfWeek)} at ${runTime}`,
      preview: buildWeeklyPreview(weekdays, hourValues, minuteValue),
      nextRuns: getCombinedNextRuns(buildModelsForHours("weekly", hourValues, minuteValue, { weekdays }), 5)
    };
  }

  if (dayValues && month === "*" && dayOfWeek === "?" && hourValues && minuteValue !== null) {
    const runTime = formatHourSummary(hourValues, minuteValue);

    return {
      valid: true,
      frequency: "Monthly",
      runTime,
      detail: `Day ${formatNumberList(dayValues)} of every month at ${runTime}`,
      preview: `Day ${formatNumberList(dayValues)} at ${runTime} each month`,
      nextRuns: getCombinedNextRuns(dayValues.flatMap(dayValue => buildModelsForHours("monthly", hourValues, minuteValue, {
        dayOfMonth: dayValue
      })), 5)
    };
  }

  if (dayValues && dayValues.length === 1 && monthValues && dayOfWeek === "?" && hourValues && minuteValue !== null) {
    const runTime = formatHourSummary(hourValues, minuteValue);

    return {
      valid: true,
      frequency: "Yearly",
      runTime,
      detail: `${formatMonthLabels(monthValues)} ${pad(dayValues[0])} at ${runTime} every year`,
      preview: `${formatMonthLabels(monthValues)} ${pad(dayValues[0])} at ${runTime}`,
      nextRuns: getCombinedNextRuns(monthValues.flatMap(monthValue => buildModelsForHours("yearly", hourValues, minuteValue, {
        dayOfMonth: dayValues[0],
        month: monthValue
      })), 5)
    };
  }

  if (dayOfMonth === "L" && dayOfWeek === "?" && hourValues && minuteValue !== null) {
    const runTime = formatHourSummary(hourValues, minuteValue);

    return {
      valid: true,
      frequency: "Monthly",
      runTime,
      detail: `Last day of every month at ${runTime}`,
      preview: `Last day at ${runTime} each month`,
      nextRuns: []
    };
  }

  if (dayOfMonth === "LW" && dayOfWeek === "?" && hourValues && minuteValue !== null) {
    const runTime = formatHourSummary(hourValues, minuteValue);

    return {
      valid: true,
      frequency: "Monthly",
      runTime,
      detail: `Last weekday of every month at ${runTime}`,
      preview: `Last weekday at ${runTime} each month`,
      nextRuns: []
    };
  }

  if (/^\d+W$/.test(dayOfMonth) && dayOfWeek === "?" && hourValues && minuteValue !== null) {
    const runTime = formatHourSummary(hourValues, minuteValue);

    return {
      valid: true,
      frequency: "Monthly",
      runTime,
      detail: `Weekday nearest day ${pad(dayOfMonth.replace("W", ""))} of every month at ${runTime}`,
      preview: `Nearest weekday to day ${pad(dayOfMonth.replace("W", ""))} at ${runTime}`,
      nextRuns: []
    };
  }

  if (dayOfMonth === "?" && supportsExtendedWeekdayField(dayOfWeek) && month === "*" && hourValues && minuteValue !== null) {
    const runTime = formatHourSummary(hourValues, minuteValue);

    return {
      valid: true,
      frequency: "Weekly",
      runTime,
      detail: `Every ${formatCronWeekdays(dayOfWeek)} at ${runTime}`,
      preview: `${formatCronWeekdays(dayOfWeek)} at ${runTime}`,
      nextRuns: []
    };
  }

  if (dayOfWeek === "?" && supportsMonthField(month) && (isNumber(dayOfMonth) || dayOfMonth === "L" || dayOfMonth === "LW") && hourValues && minuteValue !== null) {
    const runTime = formatHourSummary(hourValues, minuteValue);

    return {
      valid: true,
      frequency: "Yearly",
      runTime,
      detail: `${formatYearlyDayAndMonth(dayOfMonth, month)} at ${runTime}`,
      preview: `${formatYearlyDayAndMonth(dayOfMonth, month)} at ${runTime}`,
      nextRuns: []
    };
  }

  return {
    valid: false,
    message: "This cron pattern is not recognized yet. Supported patterns now include minute and hourly intervals, L, LW, #, month names, and weekday ranges."
  };
}

function describeTime(minutes, hours) {
  if ((hours === "*" || hours === "*/1") && /^0\/\d+$/.test(minutes)) {
    const interval = minutes.split("/")[1];
    return `every ${interval} minute${interval === "1" ? "" : "s"}`;
  }

  if (/^0\/\d+$/.test(hours) && isNumber(minutes)) {
    const interval = hours.split("/")[1];
    return `every ${interval} hour${interval === "1" ? "" : "s"} at minute ${pad(minutes)}`;
  }

  const hourValues = parseCronHours(hours);

  if (hourValues && isNumber(minutes)) {
    return `at ${formatHourSummary(hourValues, Number(minutes))}`;
  }

  return null;
}

function describeSchedule(dayOfMonth, month, dayOfWeek, year) {
  if (dayOfMonth === "*" && month === "*" && dayOfWeek === "?") {
    return "Runs every day";
  }

  if (dayOfMonth === "?" && supportsExtendedWeekdayField(dayOfWeek) && month === "*") {
    return `Runs every ${formatCronWeekdays(dayOfWeek)}`;
  }

  if (isNumber(dayOfMonth) && month === "*" && dayOfWeek === "?") {
    return `Runs on day ${pad(dayOfMonth)} of every month`;
  }

  if ((isNumber(dayOfMonth) || dayOfMonth === "L" || dayOfMonth === "LW") && supportsMonthField(month) && dayOfWeek === "?") {
    const yearText = year && year !== "*" ? ` in ${year}` : "";
    return `Runs every ${formatYearlyDayAndMonth(dayOfMonth, month)}${yearText}`;
  }

  if (dayOfMonth === "L" && month === "*" && dayOfWeek === "?") {
    return "Runs on the last day of every month";
  }

  if (dayOfMonth === "LW" && month === "*" && dayOfWeek === "?") {
    return "Runs on the last weekday of every month";
  }

  if (/^\d+W$/.test(dayOfMonth) && month === "*" && dayOfWeek === "?") {
    return `Runs on the weekday nearest day ${pad(dayOfMonth.replace("W", ""))} each month`;
  }

  if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*" ) {
    return "Runs every day";
  }

  return null;
}

function isWeekdayField(value) {
  return /^[A-Z]{3}(,[A-Z]{3})*$/.test(value);
}

function supportsExtendedWeekdayField(value) {
  return isWeekdayField(value)
    || /^[A-Z]{3}-[A-Z]{3}$/.test(value)
    || /^[A-Z]{3}#[1-5]$/.test(value)
    || /^[A-Z]{3}L$/.test(value);
}

function supportsMonthField(value) {
  return isNumber(value)
    || /^[A-Z]{3}$/.test(value)
    || /^[A-Z]{3}-[A-Z]{3}$/.test(value)
    || /^[A-Z]{3}(,[A-Z]{3})+$/.test(value);
}

function formatCronWeekdays(value) {
  if (/^[A-Z]{3}-[A-Z]{3}$/.test(value)) {
    const [start, end] = value.split("-");
    return `${WEEKDAY_NAMES[start] || start} through ${WEEKDAY_NAMES[end] || end}`;
  }

  if (/^[A-Z]{3}#[1-5]$/.test(value)) {
    const [day, occurrence] = value.split("#");
    return `${ordinalLabel(Number(occurrence))} ${WEEKDAY_NAMES[day] || day}`;
  }

  if (/^[A-Z]{3}L$/.test(value)) {
    const day = value.replace("L", "");
    return `last ${WEEKDAY_NAMES[day] || day}`;
  }

  return value
    .split(",")
    .map(code => WEEKDAY_NAMES[code] || code)
    .join(", ");
}

function formatCronMonths(value) {
  if (/^[A-Z]{3}-[A-Z]{3}$/.test(value)) {
    const [start, end] = value.split("-");
    return `${monthTokenLabel(start)} through ${monthTokenLabel(end)}`;
  }

  return value
    .split(",")
    .map(monthTokenLabel)
    .join(", ");
}

function monthTokenLabel(value) {
  if (isNumber(value)) {
    return MONTH_NAMES[Number(value) - 1] || value;
  }

  const match = MONTH_NAMES.find(name => name.slice(0, 3).toUpperCase() === String(value).toUpperCase());
  return match || value;
}

function describeYearlyDay(value) {
  if (value === "L") {
    return "the last day of";
  }

  if (value === "LW") {
    return "the last weekday of";
  }

  return pad(value);
}

function ordinalLabel(value) {
  if (value === 1) return "First";
  if (value === 2) return "Second";
  if (value === 3) return "Third";
  if (value === 4) return "Fourth";
  return "Fifth";
}

function formatYearlyDayAndMonth(dayOfMonth, month) {
  const monthText = formatCronMonths(month);
  if (dayOfMonth === "L" || dayOfMonth === "LW") {
    return `${describeYearlyDay(dayOfMonth)} ${monthText}`;
  }
  return `${monthText} ${describeYearlyDay(dayOfMonth)}`;
}

function isNumber(value) {
  return /^\d+$/.test(String(value));
}

function getNextRunAfter(afterDate, model) {
  if (model.frequency === "every-minute") {
    return getNextMinuteRun(afterDate, model.interval);
  }

  if (model.frequency === "hourly") {
    return getNextHourlyRun(afterDate, model.interval, model.minute);
  }

  if (model.frequency === "daily") {
    return getNextDailyRun(afterDate, model.hour, model.minute);
  }

  if (model.frequency === "weekly") {
    return getNextWeeklyRun(afterDate, model.weekdays, model.hour, model.minute);
  }

  if (model.frequency === "monthly") {
    return getNextMonthlyRun(afterDate, model.dayOfMonth, model.hour, model.minute);
  }

  return getNextYearlyRun(afterDate, model.month, model.dayOfMonth, model.hour, model.minute);
}

function getNextMinuteRun(afterDate, interval) {
  const candidate = new Date(afterDate);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  const alignedMinute = Math.ceil(candidate.getMinutes() / interval) * interval;
  candidate.setMinutes(alignedMinute, 0, 0);

  return candidate;
}

function getNextHourlyRun(afterDate, interval, minute) {
  const candidate = new Date(afterDate);
  candidate.setSeconds(0, 0);

  for (let attempt = 0; attempt < 48; attempt += 1) {
    const hourCandidate = new Date(candidate);
    hourCandidate.setHours(candidate.getHours() + attempt, minute, 0, 0);

    if (hourCandidate.getHours() % interval !== 0) {
      continue;
    }

    if (hourCandidate > afterDate) {
      return hourCandidate;
    }
  }

  return null;
}

function getNextDailyRun(afterDate, hour, minute) {
  const candidate = new Date(afterDate);
  candidate.setSeconds(0, 0);
  candidate.setHours(hour, minute, 0, 0);

  if (candidate <= afterDate) {
    candidate.setDate(candidate.getDate() + 1);
  }

  return candidate;
}

function getNextWeeklyRun(afterDate, weekdays, hour, minute) {
  if (weekdays.length === 0) {
    return null;
  }

  const dayIndexes = weekdays.map(toWeekdayIndex);

  for (let offset = 0; offset < 14; offset += 1) {
    const candidate = new Date(afterDate);
    candidate.setDate(afterDate.getDate() + offset);
    candidate.setHours(hour, minute, 0, 0);

    if (!dayIndexes.includes(candidate.getDay())) {
      continue;
    }

    if (candidate > afterDate) {
      return candidate;
    }
  }

  return null;
}

function getNextMonthlyRun(afterDate, dayOfMonth, hour, minute) {
  for (let offset = 0; offset < 24; offset += 1) {
    const candidate = new Date(afterDate.getFullYear(), afterDate.getMonth() + offset, 1, hour, minute, 0, 0);
    const maxDay = getMaxDayForMonth(candidate.getMonth() + 1, candidate.getFullYear());

    if (dayOfMonth > maxDay) {
      continue;
    }

    candidate.setDate(dayOfMonth);

    if (candidate > afterDate) {
      return candidate;
    }
  }

  return null;
}

function getNextYearlyRun(afterDate, month, dayOfMonth, hour, minute) {
  for (let yearOffset = 0; yearOffset < 8; yearOffset += 1) {
    const year = afterDate.getFullYear() + yearOffset;
    const maxDay = getMaxDayForMonth(month, year);

    if (dayOfMonth > maxDay) {
      continue;
    }

    const candidate = new Date(year, month - 1, dayOfMonth, hour, minute, 0, 0);

    if (candidate > afterDate) {
      return candidate;
    }
  }

  return null;
}

function formatPreviewDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function applySummary(summary) {
  document.getElementById("summaryFrequency").textContent = summary.frequency;
  document.getElementById("summaryTime").textContent = summary.runTime;
  document.getElementById("summaryDetail").textContent = summary.detail;
  document.getElementById("summaryPreview").textContent = summary.preview;
}

function toWeekdayIndex(day) {
  const indexes = {
    SUN: 0,
    MON: 1,
    TUE: 2,
    WED: 3,
    THU: 4,
    FRI: 5,
    SAT: 6
  };

  return indexes[day] ?? 1;
}

function getMaxDayForMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

function setWeekdays(days) {
  const defaults = [WEEKDAY_ORDER[0], WEEKDAY_ORDER[0], WEEKDAY_ORDER[0]];
  const values = [...days];

  document.getElementById("weekday").value = values[0] || defaults[0];
  document.getElementById("weekday2").value = values[1] || defaults[1];
  document.getElementById("weekday3").value = values[2] || defaults[2];
}

function setActivePreset(preset) {
  document.querySelectorAll(".preset-chip").forEach(button => {
    button.classList.toggle("is-active", button.dataset.preset === preset);
  });
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatFrequency(value) {
  const labels = {
    hourly: "Hourly",
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly"
  };

  return labels[value] || capitalize(value);
}

function getMonthName(value) {
  return document.getElementById("month").selectedOptions[0]?.textContent || value;
}

function getMonthLabel(value) {
  return MONTH_NAMES[Number(value) - 1] || value;
}

async function writeToClipboard(value) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, value.length);

  let copied = false;

  try {
    copied = document.execCommand("copy");
  }
  catch (error) {
    copied = false;
  }

  document.body.removeChild(textarea);

  if (copied) {
    return;
  }

  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  throw new Error("Copy command failed.");
}

function showToast(message, isError = false) {
  const toast = document.getElementById("toast");

  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.classList.toggle("toast-error", isError);
  toast.classList.add("is-visible");

  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    toast.classList.remove("is-visible");
    toast.classList.remove("toast-error");
  }, 1800);
}
