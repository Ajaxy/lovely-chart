import type { Pixel } from './types';

interface SimplifyResult {
  points: Pixel[];
  indexes: number[];
  removed: number[];
}

interface SimplifyRecord {
  start: number;
  end: number;
  index: number;
  distance: number;
  left?: SimplifyRecord;
  right?: SimplifyRecord;
}

interface QueueItem {
  start: number;
  end: number;
  record: SimplifyRecord | 0 | undefined;
  currentLimit: number;
  parent?: SimplifyRecord;
  parentProperty?: 'left' | 'right';
}

export const simplify = (() => {
  function simplify(points: Pixel[], indexes?: number[], fixedPoints?: number[]): (delta: number) => SimplifyResult {
    if (points.length < 6) {
      return function () {
        return {
          points: points,
          indexes: indexes || points.map((_, i) => i),
          removed: [],
        };
      };
    }

    let worker = precalculate(points, fixedPoints);

    return function (delta) {
      let result: Pixel[] = [],
        resultIndexes: number[] = [],
        removed: number[] = [];

      let delta2 = delta * delta,
        markers = worker(delta2);

      for (let i = 0, l = points.length; i < l; i++) {
        if (markers[i] >= delta2 || i == 0 || i == l - 1) {
          result.push(points[i]);
          resultIndexes.push(indexes ? indexes[i] : i);
        } else {
          removed.push(i);
        }
      }
      return {
        points: result,
        indexes: resultIndexes,
        removed: removed,
      };
    };
  }

  let E1 = 1.0 / Math.pow(2, 22), // максимальная дельта
    MAXLIMIT = 100000;

  function precalculate(points: Pixel[], fixedPoints?: number[]): (delta: number) => number[] {

    let len = points.length,
      distances: number[] = [],
      queue: QueueItem[] = [],
      maximumDelta = 0;
    for (let i = 0, l = points.length; i < l; ++i) {
      distances[i] = 0;
    }

    if (!fixedPoints) {
      fixedPoints = [];
    }

    //инициализируем дерево срединным значением
    //чтобы не попадает в ситуации когда начало линии близко к концу(те полигон)
    //и правильные расчеты сложны
    let subdivisionTree: SimplifyRecord | 0 = 0;

    for (let i = 0, l = fixedPoints.length; i < l; ++i) {
      distances[fixedPoints[i]] = MAXLIMIT;
    }


    function worker(params: QueueItem): SimplifyRecord {

      let start = params.start,
        end = params.end,
        record = params.record,
        currentLimit = params.currentLimit,
        usedDistance = 0;

      if (!record) {
        //let deltaShifts = getDeltaShifts(points);
        let usedIndex = -1,
          vector = [
            points[end][0] - points[start][0],
            points[end][1] - points[start][1],
          ];
        for (let i = 0, l = fixedPoints!.length; i < l; ++i) {
          let fixId = fixedPoints![i];
          if (fixId > start) {
            if (fixId < end) {
              usedIndex = fixId;
              usedDistance = MAXLIMIT;
              break;
            } else {
              break;
            }
          }
        }
        if (usedIndex < 0) {
          if (Math.abs(vector[0]) > E1 || Math.abs(vector[1]) > E1) {
            let vectorLength = vector[0] * vector[0] + vector[1] * vector[1],
              vectorLength_1 = +1.0 / vectorLength;

            for (let i = start + 1; i < end; ++i) {
              let segmentDistance = pointToSegmentDistanceSquare(points[i], points[start], points[end], vector, vectorLength_1);

              if (segmentDistance > usedDistance) {
                usedIndex = i;
                usedDistance = segmentDistance;
              }
            }

          } else {
            //фиксируем на среднинной точке
            usedIndex = Math.round((start + end) * 0.5);
            usedDistance = currentLimit;
          }
          distances[usedIndex] = usedDistance;
        }
        record = {
          start: start,
          end: end,
          index: usedIndex,
          distance: usedDistance,
        };
      }

      if (record.index && record.distance > maximumDelta) {
        if (record.index - start >= 2) {
          queue.push({
            start: start,
            end: record.index,
            record: record.left,
            currentLimit: record.distance,
            parent: record,
            parentProperty: 'left',
          });
        }
        if (end - record.index >= 2) {
          queue.push({
            start: record.index,
            end: end,
            record: record.right,
            currentLimit: record.distance,
            parent: record,
            parentProperty: 'right',
          });
        }
      }

      return record;
    }

    function tick(): SimplifyRecord {
      let request = queue.pop()!,
        result = worker(request);

      if (request.parent && request.parentProperty) {
        request.parent[request.parentProperty] = result;
      }

      return result;
    }

    return function (delta) {
      maximumDelta = delta;
      queue.push({
        start: 0,
        end: len - 1,
        record: subdivisionTree,
        currentLimit: MAXLIMIT,
      });
      subdivisionTree = tick();

      while (queue.length) {
        tick();
      }

      return distances;
    };

  }

  function pointToSegmentDistanceSquare(p: Pixel, v1: Pixel, v2: Pixel, dv: number[], dvlen_1: number): number {

    let t;
    let vx = +v1[0],
      vy = +v1[1];

    t = +((p[0] - vx) * dv[0] + (p[1] - vy) * dv[1]) * (dvlen_1);

    if (t > 1) {
      vx = +v2[0];
      vy = +v2[1];
    } else if (t > 0) {
      vx += +dv[0] * t;
      vy += +dv[1] * t;
    }

    let a = +p[0] - vx,
      b = +p[1] - vy;

    return +a * a + b * b;
  }

  return simplify;
})();
