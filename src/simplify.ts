import type { Pixel } from './types';

// Iterative Ramer–Douglas–Peucker polyline simplification with a memoized
// subdivision tree: `simplify(points)` precalculates per-point distances once,
// after which any tolerance (`delta`) can be applied cheaply. Points whose
// distance to the simplified segment is below the tolerance are removed.

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

const MIN_DELTA = 1 / 2 ** 22;
const MAX_LIMIT = 100_000;

export function simplify(
  points: Pixel[], indexes?: number[], fixedPoints?: number[],
): (delta: number) => SimplifyResult {
  if (points.length < 6) {
    return () => ({
      points,
      indexes: indexes ?? points.map((_, i) => i),
      removed: [],
    });
  }

  const calcDistances = precalculate(points, fixedPoints);

  return (delta) => {
    const result: Pixel[] = [];
    const resultIndexes: number[] = [];
    const removed: number[] = [];

    const delta2 = delta * delta;
    const markers = calcDistances(delta2);

    for (let i = 0, l = points.length; i < l; i++) {
      if (markers[i] >= delta2 || i === 0 || i === l - 1) {
        result.push(points[i]);
        resultIndexes.push(indexes ? indexes[i] : i);
      } else {
        removed.push(i);
      }
    }

    return {
      points: result,
      indexes: resultIndexes,
      removed,
    };
  };
}

function precalculate(points: Pixel[], fixedPoints: number[] = []): (delta: number) => number[] {
  const len = points.length;
  const distances: number[] = new Array(len).fill(0);
  const queue: QueueItem[] = [];
  let maximumDelta = 0;

  // Seed the subdivision tree so polylines whose start lies close to their
  // end (i.e. near-polygons) do not break the distance calculations
  let subdivisionTree: SimplifyRecord | 0 = 0;

  for (let i = 0, l = fixedPoints.length; i < l; ++i) {
    distances[fixedPoints[i]] = MAX_LIMIT;
  }

  function processSubdivision(params: QueueItem): SimplifyRecord {
    const { start, end, currentLimit } = params;
    let { record } = params;
    let usedDistance = 0;

    if (!record) {
      let usedIndex = -1;
      const vector = [
        points[end][0] - points[start][0],
        points[end][1] - points[start][1],
      ];

      for (let i = 0, l = fixedPoints.length; i < l; ++i) {
        const fixId = fixedPoints[i];
        if (fixId > start) {
          if (fixId < end) {
            usedIndex = fixId;
            usedDistance = MAX_LIMIT;
          }
          break;
        }
      }

      if (usedIndex < 0) {
        if (Math.abs(vector[0]) > MIN_DELTA || Math.abs(vector[1]) > MIN_DELTA) {
          const vectorLength = vector[0] * vector[0] + vector[1] * vector[1];
          const invVectorLength = 1 / vectorLength;

          for (let i = start + 1; i < end; ++i) {
            const segmentDistance = getSegmentDistanceSquare(
              points[i], points[start], points[end], vector, invVectorLength,
            );

            if (segmentDistance > usedDistance) {
              usedIndex = i;
              usedDistance = segmentDistance;
            }
          }
        } else {
          // Degenerate segment: pin the middle point
          usedIndex = Math.round((start + end) * 0.5);
          usedDistance = currentLimit;
        }
        distances[usedIndex] = usedDistance;
      }

      record = {
        start,
        end,
        index: usedIndex,
        distance: usedDistance,
      };
    }

    if (record.index && record.distance > maximumDelta) {
      if (record.index - start >= 2) {
        queue.push({
          start,
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
          end,
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
    const request = queue.pop()!;
    const result = processSubdivision(request);

    if (request.parent && request.parentProperty) {
      request.parent[request.parentProperty] = result;
    }

    return result;
  }

  return (delta) => {
    maximumDelta = delta;
    queue.push({
      start: 0,
      end: len - 1,
      record: subdivisionTree,
      currentLimit: MAX_LIMIT,
    });
    subdivisionTree = tick();

    while (queue.length) {
      tick();
    }

    return distances;
  };
}

function getSegmentDistanceSquare(
  point: Pixel, segmentStart: Pixel, segmentEnd: Pixel, vector: number[], invLength: number,
): number {
  let vx = segmentStart[0];
  let vy = segmentStart[1];

  const projection = ((point[0] - vx) * vector[0] + (point[1] - vy) * vector[1]) * invLength;

  if (projection > 1) {
    vx = segmentEnd[0];
    vy = segmentEnd[1];
  } else if (projection > 0) {
    vx += vector[0] * projection;
    vy += vector[1] * projection;
  }

  const dx = point[0] - vx;
  const dy = point[1] - vy;

  return dx * dx + dy * dy;
}
