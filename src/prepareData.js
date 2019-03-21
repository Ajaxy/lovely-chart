import { LovelyChart } from './lovely-chart/LovelyChart';

const LABELS_KEY = 'x';

export function prepareData(chartData) {
  const { columns, names, colors } = chartData;

  let labels = [];
  const valueColumns = [];
  const options = [];

  columns.forEach((column) => {
    const key = column[0];
    const values = column.slice(1);

    if (key === LABELS_KEY) {
      labels = values;
      return;
    }

    valueColumns.push(values);
    options.push({
      color: colors[key],
      name: names[key],
    });
  });

  const datasets = valueColumns.map((values) => {
    return values.map((value, i) => {
      return {
        x: labels[i],
        y: value,
      };
    });
  });

  return {
    datasets,
    options,
  };
}
