import { fetchData, analyzeData } from './data';
import { getFullLabelDate } from './format';
import { ZOOM_RANGE_DELTA, ZOOM_RANGE_MIDDLE, ZOOM_TIMEOUT } from './constants';

export function createZoomer(data, params, stateManager, header, minimap, tooltip, tools) {
  let _isZoomed = false;
  let _stateBeforeZoom;
  let _zoomedDateText;

  function zoomIn(state, labelIndex) {
    if (!params.dataSource || _isZoomed) {
      return;
    }

    _stateBeforeZoom = state;
    header.zoom(getFullLabelDate(data.xLabels[labelIndex]));
    tooltip.toggleSpinner(true);
    tooltip.toggleIsZoomed(true);

    const { value: date } = data.xLabels[labelIndex];
    const dataPromise = params.zoomToPie ? Promise.resolve(_generatePieData(state)) : _fetchDayData(new Date(date));
    dataPromise.then((newData) => _replaceData(newData, labelIndex));
  }

  function zoomOut(state) {
    tooltip.toggleIsZoomed(false);

    const labelIndex = Math.round((state.labelFromIndex + state.labelToIndex) / 2);
    fetchData(params).then((newData) => _replaceData(newData, labelIndex));
  }

  function _fetchDayData(date) {
    const { dataSource } = params;
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const path = `${date.getFullYear()}-${month < 10 ? '0' : ''}${month}/${day < 10 ? '0' : ''}${day}`;

    return fetch(`${dataSource}/${path}.json`)
      .then((response) => response.json());
  }

  function _replaceData(newData, labelIndex) {
    tooltip.toggleSpinner(false);

    const labelWidth = 1 / data.xLabels.length;
    const labelMiddle = labelIndex / (data.xLabels.length - 1);
    const filter = {};
    data.datasets.forEach(({ key }) => filter[key] = false);

    stateManager.update({
      range: {
        begin: labelMiddle - labelWidth / 2,
        end: labelMiddle + labelWidth / 2,
      },
      filter,
    });

    setTimeout(() => {
      if (!_isZoomed) {
        _zoomedDateText = getFullLabelDate(data.xLabels[labelIndex]);
      } else {
        _zoomedDateText = null;
      }

      Object.assign(data, analyzeData(newData, params.datasetColors, _isZoomed || params.zoomToPie ? 'days' : 'hours'));

      if (params.noMinimapOnZoom) {
        minimap.toggle(_isZoomed);
        tools.redraw();
      }

      stateManager.update({
        range: {
          begin: ZOOM_RANGE_MIDDLE - ZOOM_RANGE_DELTA,
          end: ZOOM_RANGE_MIDDLE + ZOOM_RANGE_DELTA,
        },
      }, true);

      const daysCount = _isZoomed || params.zoomToPie ? data.xLabels.length : data.xLabels.length / 24;
      const halfDayWidth = (1 / daysCount) / 2;
      const filter = {};
      data.datasets.forEach(({ key }) => filter[key] = true);

      let range;
      if (_isZoomed) {
        range = {
          begin: _stateBeforeZoom.begin,
          end: _stateBeforeZoom.end,
        };
      } else if (!params.noMinimapOnZoom) {
        range = {
          begin: ZOOM_RANGE_MIDDLE - halfDayWidth,
          end: ZOOM_RANGE_MIDDLE + halfDayWidth,
        };
      } else {
        range = {
          begin: 0,
          end: 1,
        };
      }

      stateManager.update({ range, filter });

      _isZoomed = !_isZoomed;
    }, ZOOM_TIMEOUT);
  }

  function _generatePieData(state) {
    return fetchData(params).then((sourceData) => {
      const pieData = Object.assign({}, sourceData);

      pieData.columns = sourceData.columns.map((c) => {
        const column = c.slice(state.labelFromIndex + 1, state.labelToIndex + 1);
        column.unshift(c[0]);
        return column;
      });

      Object.keys(pieData.types).forEach((key) => {
        if (key !== 'x') {
          pieData.types[key] = 'pie';
        }
      });

      pieData.pie = true;

      return pieData;
    });
  }

  return { zoomIn, zoomOut };
}
