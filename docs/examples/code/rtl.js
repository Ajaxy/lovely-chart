import LovelyChart from 'lovely-chart';

const data = await fetch('../data/bars-negative.json').then((response) => response.json());
const element = document.getElementById('chart');
const names = ['הכנסות', 'החזרים', 'התאמות'];
element.dir = 'rtl';
element.lang = 'he';

new LovelyChart(element, {
  ...data,
  title: 'רווח נקי',
  datasets: data.datasets.map((dataset, i) => ({ ...dataset, name: names[i] })),
  dateLocale: {
    months: ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'],
    monthsFull: [
      'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
      'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
    ],
    weekDays: [
      'יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'יום שבת',
    ],
    weekDaysShort: ['יום א׳', 'יום ב׳', 'יום ג׳', 'יום ד׳', 'יום ה׳', 'יום ו׳', 'שבת'],
  },
  // The total goes by the title, as the Total row would name it in English
  isTooltipTotalInTitle: true,
});
