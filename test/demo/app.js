import LovelyChart from './LovelyChart.js';

const HEBREW_DATE_LOCALE = {
  months: ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'],
  monthsFull: [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
  ],
  weekDays: ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'יום שבת'],
  weekDaysShort: ['יום א׳', 'יום ב׳', 'יום ג׳', 'יום ד׳', 'יום ה׳', 'יום ו׳', 'שבת'],
};

// The least time the data of a loading chart takes to arrive, as over a slow network, so its skeleton shows
const MIN_LOADING_TIME = 1500;

function fetchJson(path) {
  return fetch(path).then((response) => response.json());
}

function fetchDayData(dataSource, timestamp) {
  const date = new Date(timestamp);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const path = `${date.getFullYear()}-${month < 10 ? '0' : ''}${month}/${day < 10 ? '0' : ''}${day}`;

  return fetchJson(`${dataSource}/${path}.json`);
}

function formatValue(value) {
  return value.toLocaleString('en-US');
}

// A UTC date as `Fri 6 Apr`, which holds the `6 Apr` of the chart's tooltip title
function formatListDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

// A UTC range as `10 Mar — 6 Apr`, as the caption of a chart's header names it: with the year of each end unless both
// fall in the current year
function formatCaptionRange(from, to) {
  const getYear = (timestamp) => new Date(timestamp).getUTCFullYear();
  const isCurrentYear = getYear(from) === getYear(to) && getYear(to) === new Date().getUTCFullYear();
  const formatEnd = (timestamp) => new Date(timestamp).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', ...(!isCurrentYear && { year: 'numeric' }), timeZone: 'UTC',
  });
  return `${formatEnd(from)} — ${formatEnd(to)}`;
}

function appendSpans(parent, parts) {
  parts.forEach(([className, text]) => {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text;
    parent.appendChild(span);
  });
}

// The date and the total of the selected day, a row for each dataset on screen with a swatch of its colour and the
// comparison with its change, or a hint while no day is selected
function renderReadout(readout, tooltip, colors) {
  if (!tooltip) {
    const hint = document.createElement('p');
    hint.className = 'readout-hint';
    hint.textContent = 'Point at a day, or focus the chart and press ← or →';
    readout.replaceChildren(hint);
    return;
  }

  const title = createReadoutLine('readout-title', tooltip.title, formatReadoutValue(tooltip.total));
  const rows = tooltip.rows.map(({ datasetIndex, name, value }) => {
    const row = createReadoutLine('readout-row', name, formatReadoutValue(value));
    const swatch = document.createElement('span');
    swatch.className = 'readout-swatch';
    swatch.style.backgroundColor = colors[datasetIndex];
    row.firstChild.prepend(swatch);
    return row;
  });
  const { name, value, change } = tooltip.comparison;
  const comparison = createReadoutLine('readout-comparison', name, formatReadoutValue(value));
  if (change !== undefined) {
    const changeElement = document.createElement('span');
    changeElement.className = 'readout-change';
    changeElement.dataset.tone = change < 0 ? 'negative' : 'positive';
    changeElement.textContent = `${change < 0 ? '−' : '+'}${Math.abs(change).toFixed(1)}%`;
    comparison.lastChild.append(' ', changeElement);
  }
  readout.replaceChildren(title, ...rows, comparison);
}

function createReadoutLine(className, name, value) {
  const line = document.createElement('div');
  line.className = `readout-line ${className}`;
  appendSpans(line, [['readout-name', name], ['readout-value', value]]);
  return line;
}

// A gap reads as a dash
function formatReadoutValue(value) {
  return value === null ? '—' : formatValue(value);
}

// The title and the caption of a set of charts without headers, a key of their datasets' lines and the grid of their
// cells
function createMultiples(title, caption, keys, color) {
  const multiples = document.createElement('div');
  multiples.className = 'multiples';
  multiples.style.setProperty('--multiples-color', color);

  const header = document.createElement('div');
  header.className = 'multiples-header';
  appendSpans(header, [['multiples-title', title], ['multiples-caption', caption]]);
  multiples.appendChild(header);

  const legend = document.createElement('div');
  legend.className = 'multiples-keys';
  keys.forEach(([name, isDashed]) => {
    appendSpans(legend, [[`multiples-key${isDashed ? ' multiples-key-dashed' : ''}`, name]]);
  });
  multiples.appendChild(legend);

  const grid = document.createElement('div');
  grid.className = 'multiples-grid';
  multiples.appendChild(grid);

  return multiples;
}

function createMultiple(name, value) {
  const cell = document.createElement('div');
  cell.className = 'multiple';
  const header = document.createElement('div');
  header.className = 'multiple-header';
  appendSpans(header, [['multiple-name', name], ['multiple-value', value]]);
  cell.appendChild(header);
  return cell;
}

function createDayPicker(dayButtons, stepSelection) {
  const picker = document.createElement('div');
  picker.className = 'day-picker';

  const steps = document.createElement('div');
  steps.className = 'day-picker-steps';
  [['‹ Previous day', -1], ['Next day ›', 1]].forEach(([text, step]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'day-picker-step';
    button.textContent = text;
    button.addEventListener('click', () => stepSelection(step));
    steps.appendChild(button);
  });
  picker.appendChild(steps);

  const list = document.createElement('ol');
  list.className = 'day-picker-days';
  list.setAttribute('aria-label', 'Last week');
  dayButtons.forEach((button) => {
    const item = document.createElement('li');
    item.appendChild(button);
    list.appendChild(item);
  });
  picker.appendChild(list);

  return picker;
}

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('container');

  (async () => {
    const data = await Promise.all([
      fetchJson('./data/lines.json'),
      fetchJson('./data/lines-negative.json'),
      fetchJson('./data/bars.json'),
      fetchJson('./data/bars-negative.json'),
      fetchJson('./data/areas-absolute.json'),
      fetchJson('./data/areas.json'),
      fetchJson('./data/donut.json'),
      fetchJson('./data/steps.json'),
      fetchJson('./data/bars-monthly.json'),
    ]);

    data.slice(0, 8).forEach((chart, i) => {
      // "Lovely Lines", with its minimap, and "Negative Lovely Lines", without one, select a range dragged across the
      // plot, and show the whole range again on a double click
      if (i === 0 || i === 1) {
        chart.isRangeSelectable = true;
      }

      if (i === 2) {
        chart.onZoom = (date) => fetchDayData('data/zoom_bars', date);
      }

      // "Lovely Areas with Zoom" — limit selection to September 1, 2025 onwards
      if (i === 5) {
        chart.limitDate = 1756684800000;
        chart.onLimitedRangeClick = () => alert('Data before September 2025 is not available');
      }

      new LovelyChart(container, chart);
    });

    // Monthly stacked bars of absolute values, drilling into a single month's
    // composition — `zoomToShares` keeps the bar heights the overview is for,
    // and `circleLabelsAround` lets the zoomed minimap reach every month
    new LovelyChart(container, data[8]);

    // The last 8 weeks of stacked areas against the week before, under a capacity line the stack never
    // reaches: the Y range still widens to show it
    const areas = data[4];
    const weeks = 56;
    const weekAgo = 7;
    new LovelyChart(container, {
      ...areas,
      title: 'Lovely Areas with a Previous Week',
      withMinimap: false,
      labels: areas.labels.slice(-weeks),
      datasets: areas.datasets.map((dataset) => ({ ...dataset, values: dataset.values.slice(-weeks) })),
      comparison: {
        name: 'Week before',
        values: areas.datasets.map(({ values }) => values.slice(-weeks - weekAgo, -weekAgo)),
      },
      referenceLines: [{ value: 150000, label: 'Capacity' }],
      isTooltipOrderFixed: true,
      isTooltipTotalInTitle: true,
      formatTooltipValue: (value) => value.toLocaleString('en-US'),
      isYAxisOutward: true,
      areLabelsContrast: true,
      noZoom: true,
    });

    // Solid, dashed and dotted datasets of one hue, a limit line in a colour per skin, day labels read in UTC and the
    // days still to come hatched under the steps, from a dashed edge
    const steps = data[7];
    const [standard, premium] = steps.datasets;
    const planColor = '#3497ED';
    const trialLevels = [350, 500, 250, 600, 450, 300];
    const trialLevelDays = 5;
    const plannedDays = 5;
    new LovelyChart(container, {
      ...steps,
      title: 'Lovely Steps with a Limit',
      datasets: [
        { ...standard, color: planColor },
        { ...premium, color: planColor, isDashed: true },
        {
          name: 'Trial',
          color: planColor,
          values: steps.labels.map((_, i) => trialLevels[Math.floor(i / trialLevelDays)]),
          isDotted: true,
        },
      ],
      referenceLines: [{ value: 1500, label: 'Limit', color: { light: '#E65850', dark: '#F07068' } }],
      hatchedRanges: [{
        from: steps.labels.length - plannedDays,
        to: steps.labels.length - 1,
        label: 'Planned',
        hasEdge: true,
      }],
      isUtc: true,
    });

    // The plot alone, as beside a figure in a table
    const lines = data[0];
    new LovelyChart(container, {
      title: 'Lovely Sparkline',
      type: 'area',
      labels: lines.labels.slice(-30),
      datasets: [{ ...lines.datasets[1], values: lines.datasets[1].values.slice(-30) }],
      isSparkline: true,
      plotHeight: 64,
      areaOpacity: 0.25,
      areaBorderColor: lines.datasets[1].color,
      noZoom: true,
    });

    // Monotone curves through a month of days, Kiwi hidden until its legend button is checked, under larger axis
    // labels in a colour per skin
    const fruits = data[4];
    const days = 30;
    const [apples, oranges, , , kiwi] = fruits.datasets;
    new LovelyChart(container, {
      title: 'Lovely Smooth Lines',
      type: 'line',
      labels: fruits.labels.slice(-days),
      datasets: [
        { name: apples.name, color: '#E65850', values: apples.values.slice(-days) },
        { name: oranges.name, color: '#F79E39', values: oranges.values.slice(-days) },
        { name: kiwi.name, color: '#5FB641', values: kiwi.values.slice(-days), isInitiallyHidden: true },
      ],
      areLinesSmooth: true,
      axisFontSize: 12,
      axisTextColor: { light: '#2373DB', dark: '#7FB8F0' },
    });

    // A badge with the total of the forecast week stands at the bottom left of the plot, placed by the plot-area
    // variables the chart sets on an element of its own, so it follows the plot through resizes. The badge comes before
    // the chart, which paints the line and the tooltip over it.
    const forecastDays = 28;
    const forecastWeek = 7;
    const forecastPromoDay = 9;
    const lemons = fruits.datasets[2];
    const forecastValues = lemons.values.slice(-forecastDays);
    const forecastTotal = forecastValues.slice(-forecastWeek).reduce((sum, value) => sum + value, 0);
    const forecastElement = document.createElement('div');
    forecastElement.className = 'forecast-chart';
    const forecastBadge = document.createElement('div');
    forecastBadge.className = 'forecast-badge';
    forecastBadge.textContent = `Next ${forecastWeek} days: ${forecastTotal.toLocaleString('en-US')}`;
    forecastElement.appendChild(forecastBadge);
    container.appendChild(forecastElement);
    new LovelyChart(forecastElement, {
      title: 'Lovely Forecast',
      type: 'line',
      labels: fruits.labels.slice(-forecastDays),
      datasets: [{ name: lemons.name, color: '#3497ED', values: forecastValues }],
      isYAxisOutward: true,
      hatchedRanges: [{
        from: forecastDays - forecastWeek,
        to: forecastDays - 1,
        label: 'Forecast',
        hasEdge: true,
        color: { light: '#108BE3', dark: '#48AAF0' },
        note: 'Forecast',
      }],
      // A promotion that started halfway through a day, pinned by a head over the axis labels, with a note under the
      // tooltip rows of its day
      eventLines: [{
        labelIndex: forecastPromoDay,
        offset: 0.5,
        label: 'Promo',
        isDashed: true,
        withHead: true,
        hint: 'Promo from noon:\n20% off for a week',
      }],
    });

    // The last week of the bars as a list whose rows select their day in the chart on hover and focus, and buttons
    // that step the selection, as the arrow keys do on the focused plot; `onSelectedIndexChange` marks the row of the
    // day the tooltip shows
    const bars = data[2];
    const barDays = 30;
    const listedDays = 7;
    const barLabels = bars.labels.slice(-barDays);
    const barKiwi = bars.datasets[4];
    const barValues = barKiwi.values.slice(-barDays);
    let lastSelectedIndex;
    const dayButtons = barLabels.slice(-listedDays).map((label, i) => {
      const index = barDays - listedDays + i;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'day-picker-day';
      button.dataset.index = String(index);
      appendSpans(button, [
        ['day-picker-date', formatListDate(label)], ['day-picker-value', formatValue(barValues[index])],
      ]);
      button.addEventListener('mouseenter', () => pickerChart.selectLabel(index));
      button.addEventListener('focus', () => pickerChart.selectLabel(index));
      return button;
    });
    const pickerChart = new LovelyChart(container, {
      title: 'Lovely Day Picker',
      type: 'bar',
      labels: barLabels,
      datasets: [{ name: barKiwi.name, color: '#5FB641', values: barValues }],
      // Starts the bars at zero
      referenceLines: [{ value: 0, color: 'transparent' }],
      // The list reads its dates in UTC
      isUtc: true,
      formatTooltipValue: formatValue,
      isKeyboardSelectable: true,
      onSelectedIndexChange: (index) => {
        // A selection the pointer makes on the chart clears as the pointer leaves it or a step button is touched, so
        // the buttons step from the last selected day
        lastSelectedIndex = index ?? lastSelectedIndex;
        dayButtons.forEach((button) => {
          if (Number(button.dataset.index) === index) {
            button.setAttribute('aria-current', 'date');
          } else {
            button.removeAttribute('aria-current');
          }
        });
      },
    });
    const stepSelection = (step) => pickerChart.selectLabel(lastSelectedIndex === undefined
      ? barDays - 1
      : Math.min(barDays - 1, Math.max(0, lastSelectedIndex + step)));
    container.appendChild(createDayPicker(dayButtons, stepSelection));

    // Hebrew dates and names on a right-to-left page, where the negative values of the tooltip and the Y axis keep
    // their signs before the digits. The total goes by the tooltip title, as the Total row names it in English.
    const netBars = data[3];
    const hebrewNames = ['הכנסות', 'החזרים', 'התאמות'];
    const rtlElement = document.createElement('div');
    rtlElement.dir = 'rtl';
    rtlElement.lang = 'he';
    container.appendChild(rtlElement);
    new LovelyChart(rtlElement, {
      ...netBars,
      title: 'Lovely Right-to-Left Bars',
      datasets: netBars.datasets.map((dataset, i) => ({ ...dataset, name: hebrewNames[i] })),
      dateLocale: HEBREW_DATE_LOCALE,
      isTooltipTotalInTitle: true,
    });

    // The monthly spending under a budget for each half of the year, drawn as dashed steps over the stack of bars, with
    // the last two months estimated, hatched over the bars and under the steps. The budget stays out of the stack, the
    // Total row of the tooltip and the shares of a zoomed month.
    const spending = data[8];
    const halfYearBudgets = [2800, 3000];
    const monthsInHalfYear = 6;
    const estimatedMonths = 2;
    new LovelyChart(container, {
      ...spending,
      title: 'Lovely Spending against a Budget',
      datasets: [
        ...spending.datasets,
        {
          name: 'Budget',
          type: 'step',
          color: '#2373DB',
          values: spending.labels.map((_, i) => halfYearBudgets[Math.floor(i / monthsInHalfYear)]),
          isDashed: true,
        },
      ],
      hatchedRanges: [{
        from: spending.labels.length - estimatedMonths,
        to: spending.labels.length - 1,
        label: 'Estimated',
      }],
    });

    // A month of three fruits stacked by day, beside the share of apples in them, a line on a Y axis of its own at the
    // right. The share stays out of the stack and the Total row of the tooltip.
    const stackDays = 30;
    const stackColors = ['#E65850', '#F79E39', '#F5BD25'];
    const stackDatasets = fruits.datasets.slice(0, stackColors.length).map(({ name, values }, i) => ({
      name, color: stackColors[i], values: values.slice(-stackDays),
    }));
    new LovelyChart(container, {
      title: 'Lovely Bars on Two Axes',
      type: 'bar',
      isStacked: true,
      hasSecondYAxis: true,
      labels: fruits.labels.slice(-stackDays),
      datasets: [
        ...stackDatasets,
        {
          name: 'Apples, %',
          type: 'line',
          color: '#2373DB',
          values: stackDatasets[0].values.map((apples, i) => {
            const total = stackDatasets.reduce((sum, { values }) => sum + values[i], 0);
            return Math.round((apples / total) * 1000) / 10;
          }),
        },
      ],
      formatTooltipValue: formatValue,
      areLabelsContrast: true,
    });

    // A readout of the page in place of the tooltip balloon, which `--lovely-chart-balloon-display` hides: it shows
    // the `TooltipContent` that `onTooltipChange` reports for a day the pointer, a touch or the arrow keys on the
    // focused plot select. The bars take the accent of the page and its mixes with the page background, `var()` and
    // `color-mix()` colours that follow the skin, as the swatches of the readout do.
    const readoutDays = 14;
    const readoutColors = [
      'var(--page-accent)',
      'color-mix(in srgb, var(--page-accent) 60%, var(--page-background))',
      'color-mix(in srgb, var(--page-accent) 30%, var(--page-background))',
    ];
    const readoutFruits = bars.datasets.slice(0, readoutColors.length);
    const readoutElement = document.createElement('div');
    readoutElement.className = 'readout-chart';
    container.appendChild(readoutElement);
    const readout = document.createElement('div');
    readout.className = 'readout';
    new LovelyChart(readoutElement, {
      title: 'Lovely Readout',
      type: 'bar',
      isStacked: true,
      labels: bars.labels.slice(-readoutDays),
      datasets: readoutFruits.map(({ name, values }, i) => ({
        name, color: readoutColors[i], values: values.slice(-readoutDays),
      })),
      comparison: {
        name: 'Two weeks before',
        values: readoutFruits.map(({ values }) => values.slice(-readoutDays * 2, -readoutDays)),
      },
      isKeyboardSelectable: true,
      onTooltipChange: (tooltip) => renderReadout(readout, tooltip, readoutColors),
    });
    readoutElement.appendChild(readout);
    renderReadout(readout, undefined, readoutColors);

    // A chart in place before its data arrives: a skeleton in its own geometry, in a `--skeleton-color` the page sets
    // for each skin, until `update()` brings the data. The button loads the data again.
    const skeletonParams = { title: 'Lovely Loading Lines', type: 'line', withMinimap: true };
    const skeletonData = {
      ...skeletonParams,
      labels: [],
      datasets: lines.datasets.map(({ name, color }) => ({ name, color, values: [] })),
      isLoading: true,
    };
    const skeletonElement = document.createElement('div');
    skeletonElement.className = 'skeleton-chart';
    container.appendChild(skeletonElement);
    const skeletonChart = new LovelyChart(skeletonElement, skeletonData);
    const reloadButton = document.createElement('button');
    reloadButton.type = 'button';
    reloadButton.className = 'reload-button';
    skeletonElement.appendChild(reloadButton);
    // A load that fails leaves the skeleton, and the button to try again
    const loadLines = async () => {
      reloadButton.disabled = true;
      reloadButton.textContent = 'Loading…';
      try {
        const [{ labels, datasets }] = await Promise.all([
          fetchJson('./data/lines.json'),
          new Promise((resolve) => setTimeout(resolve, MIN_LOADING_TIME)),
        ]);
        skeletonChart.update({ ...skeletonParams, labels, datasets });
      } finally {
        reloadButton.disabled = false;
        reloadButton.textContent = 'Reload the data';
      }
    };
    reloadButton.addEventListener('click', () => {
      skeletonChart.update(skeletonData);
      loadLines();
    });
    loadLines();

    // Small multiples of four fruits, the last four weeks of each against the four before, as the axes and the plot
    // alone: `noHeader` leaves out the band of the title, `noTooltip` the hover layer and a `legendContainer` left out
    // of the document the legend. The page titles each chart with its latest value and draws one key for all.
    const multipleDays = 28;
    const multipleColor = '#3497ED';
    const multipleLabels = fruits.labels.slice(-multipleDays);
    const multiples = createMultiples(
      'Lovely Small Multiples',
      formatCaptionRange(multipleLabels[0], multipleLabels[multipleDays - 1]),
      [['Last 4 weeks', false], ['The 4 weeks before', true]],
      multipleColor,
    );
    container.appendChild(multiples);
    fruits.datasets.slice(0, 4).forEach(({ name, values }) => {
      const recent = values.slice(-multipleDays);
      const cell = createMultiple(name, formatValue(recent[multipleDays - 1]));
      multiples.querySelector('.multiples-grid').appendChild(cell);
      new LovelyChart(cell, {
        type: 'line',
        labels: multipleLabels,
        datasets: [
          { name: 'Last 4 weeks', color: multipleColor, values: recent },
          {
            name: 'The 4 weeks before',
            color: multipleColor,
            values: values.slice(-multipleDays * 2, -multipleDays),
            isDashed: true,
          },
        ],
        ariaLabel: `${name}, the last 4 weeks against the 4 before`,
        plotHeight: 120,
        isUtc: true,
        areLabelsContrast: true,
        noHeader: true,
        noTooltip: true,
        legendContainer: document.createElement('div'),
      });
    });
  })();

  document.getElementById('skin-switcher').addEventListener('click', (e) => {
    e.preventDefault();

    document.documentElement.classList.toggle('theme-dark');

    const skin = document.documentElement.classList.contains('theme-dark') ? 'skin-night' : 'skin-day';
    e.target.innerText = `Switch to ${(skin === 'skin-night') ? 'Day' : 'Night'} Mode`;
  });
});
