# Dates, time zones and locales

Most charts run along time. This page shows how the chart turns timestamps into labels, how to pick their format and time zone, when to use text labels instead, what the header caption says, and how to show dates in another language or on a right-to-left page.

## Timestamp labels

[`labels`](api.md#labels) holds UNIX timestamps in milliseconds, one per value. The chart picks the kind of label from the step between the first two of them, unless you set [`labelType`](api.md#labelType):

| `labelType` | Inferred from a step of | Axis label | Reads in |
|---|---|---|---|
| `year` | 365 days or more | `2026` | UTC |
| `month` | 28 days or more | `January` | UTC |
| `week` | 7 days or more | `Week 1` | UTC |
| `day` | a day or more | `18 Nov` | The reader's time zone, or UTC with `isUtc` |
| `hour` | an hour or more | `14:00` | The reader's time zone, or UTC with `isUtc` |
| `5min` | less than an hour | `14:05` | The reader's time zone, or UTC with `isUtc` |
| `dayHour` | never inferred | `18 Nov 14:00` | The reader's time zone, or UTC with `isUtc` |
| `text` | strings, not timestamps | The string itself | — |

- A `week` label is the ISO 8601 week number of the label's UTC date, so 29 Dec 2025 reads `Week 1` and 28 Dec 2026 `Week 53`.
- A single timestamp, as in a pie of one period, counts as `day`.
- `labelType` sets the granularity of the [header caption](#the-header-caption) too: a year chart reads `2022 — 2026`, a month chart `February — March 2029`.

Set `labelType` yourself for `dayHour`, which the chart never infers, or when the step between the first two labels isn't the step of the data.

## Label and tooltip formats

### Axis label formats

[`labelFormatter`](api.md#labelFormatter) gives the X-axis labels another format than the one of `labelType`, while the caption keeps the granularity of `labelType`. It takes one of these strings:

| `labelFormatter` | Reads |
|---|---|
| `'statsFormatYear'` | `2026` |
| `'statsFormatMonth'` | `January` |
| `'statsFormatWeek'` | `Week 1` |
| `"statsFormat('day')"` | `18 Nov` |
| `"statsFormat('hour')"` or `"statsFormat('5min')"` | `14:00` |
| `'statsFormatDayHour'` | `18 Nov 14:00` |

The quotes inside are part of the string: write `"statsFormat('day')"`, not `statsFormat('day')` or `'day'`.

The most common use labels weekly data by the date each week starts on, in place of week numbers:

```js live
import LovelyChart from 'lovely-chart';
import { series } from './demo-data.js';

const WEEK = 7 * 24 * 60 * 60 * 1000;
// 16 Mondays at UTC midnight, from 6 Jul 2026
const labels = Array.from({ length: 16 }, (_, i) => Date.UTC(2026, 6, 6) + i * WEEK);

new LovelyChart(document.getElementById('chart'), {
  title: 'Weekly sign-ups',
  type: 'bar',
  labels,
  datasets: [
    { name: 'Sign-ups', color: '#5FB641', values: series(16, { start: 1800, trend: 0.02, seed: 14 }) },
  ],
  labelFormatter: "statsFormat('day')",
  tooltipFormatter: "statsTooltipFormat('week')",
  isUtc: true,
});
```

`isUtc: true` matters here: the day format follows the reader's time zone, where a Monday at UTC midnight is still Sunday for a reader west of UTC. See [Time zones](#time-zones).

### Tooltip title formats

The tooltip title is the X-axis label, unless [`tooltipFormatter`](api.md#tooltipFormatter) gives it a format of its own:

| `tooltipFormatter` | Reads |
|---|---|
| `"statsTooltipFormat('day')"` | `18 Nov 2026` |
| `"statsTooltipFormat('week')"` | `Week of 16 Nov` |
| `"statsTooltipFormat('hour')"` or `"statsTooltipFormat('5min')"` | `14:00` |
| `'statsFormatDayHourFull'` | `18 Nov 14:00` |

Use it to add what the axis leaves out: the year of a day, or the day of an hour. Here the axis shows the hours, and the tooltip the day with them:

```js live
import LovelyChart from 'lovely-chart';
import { hours, series } from './demo-data.js';

new LovelyChart(document.getElementById('chart'), {
  title: 'API requests',
  type: 'line',
  labels: hours(72),
  datasets: [
    {
      name: 'Requests',
      values: series(72, { start: 5200, volatility: 0.05, seasonality: 0.35, period: 24, seed: 9 }),
    },
  ],
  tooltipFormatter: 'statsFormatDayHourFull',
  withMinimap: true,
});
```

This chart has no `isUtc`, so its hours read in your own time zone.

## Time zones

A timestamp is a moment, and the day or the hour it falls on depends on the time zone. Some texts follow [`isUtc`](api.md#isUtc), and the others always read UTC:

| Reads in the reader's time zone, or in UTC with `isUtc: true` | Always reads in UTC |
|---|---|
| Axis labels of `day`, `hour`, `5min` and `dayHour`, and the tooltip titles that repeat them | Axis labels of `year`, `month` and `week` |
| Tooltip titles of `"statsTooltipFormat('hour')"`, `"statsTooltipFormat('5min')"` and `'statsFormatDayHourFull'` | Tooltip titles of `"statsTooltipFormat('day')"` and `"statsTooltipFormat('week')"` |
| | The header caption |

Which to choose:

- **Daily or weekly data stamped at UTC midnight**, as most servers send it: set `isUtc: true`. Without it, a reader west of UTC sees each day labelled as the day before, under a caption that names the right days.
- **Hourly data:** leave `isUtc` unset to show each reader their own clock, or set it to show everyone the same UTC hours, and say so in the title.

> [!TIP]
> The demo data of these docs, `days()`, `hours()` and `months()`, is stamped in UTC, which is why most examples set `isUtc: true`.

## Text labels

Strings in `labels` make text labels, `labelType: 'text'`. The axis and the tooltip title show them as they are, and the header shows no caption: the `title` alone, or nothing with no title.

```js live
import LovelyChart from 'lovely-chart';

new LovelyChart(document.getElementById('chart'), {
  title: 'Orders by weekday',
  type: 'bar',
  isStacked: true,
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  datasets: [
    { name: 'Web', values: [412, 438, 451, 470, 502, 365, 298] },
    { name: 'App', values: [286, 301, 296, 318, 344, 402, 379] },
  ],
});
```

- Where a callback takes the value of a label, such as [`onZoom`](api.md#onZoom), [`onZoomChange`](api.md#onZoomChange) and [`resolveTooltipNotes`](api.md#resolveTooltipNotes), a text label's value is its index in `labels`.
- A pie or a donut of one total per dataset takes a single text label, as `labels: ['Total']`: see [Chart types](chart-types.md).

## The header caption

The caption at the end of the header names the dates on screen, at the granularity of `labelType`, and follows the reader as they pan and zoom:

| Labels | The window holds | Caption |
|---|---|---|
| Days, weeks or hours | Several days | `1 Nov — 30 Nov`, or `1 Jan 2026 — 18 Feb 2027` across years |
| Days or hours | One day | `Friday, 6 Nov` |
| Months | Several months | `February — March 2029` |
| Months | One month | `April 2029` |
| Years | Several years | `2022 — 2026` |

The year is left out when it's the current one for both ends. The caption always reads UTC, in the language of [`dateLocale`](#localized-names).

To leave it out, set [`noCaption: true`](api.md#noCaption). It stays out while zoomed too, with no `noCaption` needed in the data [`onZoom`](zoom.md#loading-detail-data) returns. With no `title` either, the header has nothing to show and folds to [`--lovely-chart-empty-header-height`](css.md#--lovely-chart-empty-header-height), 0 by default, so the plot starts at the top of the chart. See [Layout](layout.md) for the header itself.

## Localized names

[`dateLocale`](api.md#dateLocale) gives the names in dates in another language: `{ months, monthsFull, weekDays, weekDaysShort, weekOf }`. Each field is optional and falls back to English.

| Field | Holds | Shows in |
|---|---|---|
| `months` | 12 short month names, from January | Day and day-hour labels (`18 Nov`), the day and week tooltip titles, the caption of days |
| `monthsFull` | 12 full month names, from January | Month labels (`January`) and the caption of months (`April 2029`) |
| `weekDays`, `weekDaysShort` | 7 weekday names, full and short, from Sunday | The full ones name the day in the caption of a single day (`Friday, 6 Nov`) |
| `weekOf` | The words before the date in a week title | `Week of 16 Nov`, from `"statsTooltipFormat('week')"` |

```js live
import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

const es = {
  months: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'],
  monthsFull: [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ],
  weekDays: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  weekDaysShort: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
  weekOf: 'Semana del',
};

new LovelyChart(document.getElementById('chart'), {
  title: 'Reservas diarias',
  type: 'line',
  labels: days(90),
  datasets: [{ name: 'Reservas', values: series(90, { start: 340, seasonality: 0.2, seed: 21 }) }],
  dateLocale: es,
  tooltipFormatter: "statsTooltipFormat('day')",
  withMinimap: true,
  isUtc: true,
});
```

A few texts of the chart stay in English whatever `dateLocale` says, and each has its own way out:

- `week` labels read `Week 1`: label weeks by the day they start on with `labelFormatter: "statsFormat('day')"`, [as above](#axis-label-formats).
- The Total row of the tooltip is named `Total`: [`isTooltipTotalInTitle`](api.md#isTooltipTotalInTitle) puts the total beside the title, with no name.
- The zoom-out control reads `Zoom out`: set [`zoomOutLabel`](api.md#zoomOutLabel).
- The plot's accessible name is an English summary of the data: set [`ariaLabel`](api.md#ariaLabel). See [Accessibility](accessibility.md).

The axis labels keep `K`, `M`, `B` and `T` for thousands and up. For the numbers of the tooltip in the reader's language, use [`formatTooltipValue`](axes.md#formatting-tooltip-numbers) with `toLocaleString()`.

## Right-to-left pages

Put the chart in an element with `dir="rtl"`, or on a page whose `<html>` has it, and the chart lays out from the right: the title at the right of the header and the caption at the left, the legend from the right, and the swatch and the name of each tooltip row before its value.

What reads in which direction:

- **The plot, the X axis and the minimap** run left to right on any page, the earliest label at the left.
- **Dates and text labels**, on the X axis, in the header caption and in the tooltip title, read in the direction of their first letter, whatever the direction of the page: English dates left to right, and dates in Hebrew or Arabic words right to left. With no letter, as in `2022 — 2026`, they read left to right, the way the X axis runs.
- **Numbers** read left to right, each sign before its digits: the Y-axis labels, and the values, the totals and the shares of the tooltip.
- **Reference line labels** read in the direction of the page: see [Annotations](annotations.md#reference-lines) to keep a sign first.

```js live
import LovelyChart from 'lovely-chart';

const element = document.getElementById('chart');
element.dir = 'rtl';
element.lang = 'he';

const data = await fetch('../data/bars-negative.json').then((response) => response.json());
const names = ['הכנסות', 'החזרים', 'התאמות'];

new LovelyChart(element, {
  ...data,
  title: 'רווח והפסד יומי',
  datasets: data.datasets.map((dataset, i) => ({ ...dataset, name: names[i] })),
  dateLocale: {
    months: ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'],
    monthsFull: [
      'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
    ],
    weekDays: ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'יום שבת'],
    weekDaysShort: ['יום א׳', 'יום ב׳', 'יום ג׳', 'יום ד׳', 'יום ה׳', 'יום ו׳', 'שבת'],
  },
  // The Total row is named in English, so the total goes beside the title
  isTooltipTotalInTitle: true,
  isUtc: true,
});
```

The dates read right to left, as their first letter is Hebrew, while the negative values keep their minus signs before the digits.
