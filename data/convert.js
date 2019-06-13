const fs = require('fs');
const glob = require('glob');

(async () => {
  glob('./chart_data.json', null, function (err, files) {
    files.forEach((file) => {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      console.log({data});
      const { columns, names, colors } = data;
      const labels = columns.find(([key]) => key === 'x').slice(1);
      const datasets = [];
      const result = {
        title: 'Title',
        type: 'bar',
        labels,
        labelType: 'hour',
        isStacked: true,
        isPercentage: false,
        hasSecondYAxis: false,
        onZoom: null,
        datasets,
      };

      columns.forEach((column) => {
        const [key, ...values] = column;

        if (key === 'x') {
          return;
        }

        datasets.push({
          name: names[key],
          color: colors[key],
          values,
        });
      });

      fs.writeFileSync(file, JSON.stringify(result, null, '\t'));
    });
  });
})();
