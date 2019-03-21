// https://jsperf.com/finding-maximum-element-in-an-array
export function getMaxMin(array) {
  const length = array.length;
  let max = array[0];
  let min = array[0];

  for (let i = 0; i < length; i++) {
    const value = array[i];

    if (value > max) {
      max = value;
    } else if (value < min) {
      min = value;
    }
  }

  return { max, min };
}

export function getMaxMinBy(array, key) {
  const values = array.map((member) => member[key]);
  return getMaxMin(values);
}

// https://jsperf.com/multi-array-concat/24
export function mergeArrays(arrays) {
  return [].concat.apply([], arrays);
}

export function toYByX(dataset) {
  const byX = {};

  dataset.forEach(({ x, y }) => {
    byX[String(x)] = y;
  });

  return byX;
}
