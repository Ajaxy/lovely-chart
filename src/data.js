import LovelyChart from './LovelyChart';


// TODO convert and sort datasets
export default {
  xType: LovelyChart.XTypeDate,
  datasets: [
    [
      { x: +new Date('2019-01-07'), y: 50 },
      { x: +new Date('2019-02-23'), y: 200 },
      { x: +new Date('2019-03-08'), y: 100 },
    ],
    [
      { x: +new Date('2018-12-31'), y: 5 },
      { x: +new Date('2019-01-06'), y: 20 },
      { x: +new Date('2019-04-02'), y: 10 },
    ],
  ],
  options: [
    { color: '#3DC23F' },
    { color: '#F34C44' },
  ],
};
