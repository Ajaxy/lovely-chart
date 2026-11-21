import LovelyChart from 'lovely-chart';
import { days, series } from './demo-data.js';

// A label per week, on the Monday each starts
const labels = days(26 * 7, { end: Date.UTC(2026, 10, 16) }).filter((_, i) => i % 7 === 0);

new LovelyChart(document.getElementById('chart'), {
  title: 'Pedidos por semana',
  type: 'bar',
  isStacked: true,
  labels,
  datasets: [
    { name: 'Tienda', values: series(26, { start: 4200, volatility: 0.06, seed: 231 }) },
    {
      name: 'En línea',
      values: series(26, { start: 2600, trend: 0.01, volatility: 0.06, seed: 232 }),
    },
  ],
  // `14 sep` on the axis and `Semana del 14 sep` in the tooltip
  labelFormatter: "statsFormat('day')",
  tooltipFormatter: "statsTooltipFormat('week')",
  isUtc: true,
  dateLocale: {
    months: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
    monthsFull: [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre',
      'diciembre',
    ],
    weekDays: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
    weekDaysShort: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
    weekOf: 'Semana del',
  },
});
