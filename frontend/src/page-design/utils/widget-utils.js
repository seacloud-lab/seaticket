import { CellType, FORMULA_RESULT_TYPE, SELECT_OPTION_COLORS, getDateDisplayString, getTableColumnByKey, getNumberDisplayString,
  getCellValueDisplayString, getViewShownColumns } from 'dtable-utils';
import { getPreviewContent } from '@seafile/seafile-editor';
import { getDigitalSignImageUrl } from 'dtable-ui-component/lib/DigitalSignFormatter/utils';
import {
  FORMULA_COLUMN_TYPES,
  STATIC_CELL_TYPE,
  IMAGE_DISPLAY_TYPE,
  LINK_TABLE,
  DYNAMIC_CELL_TYPE,
  VIEW_TYPE,
  TABLE_ROW_HEIGHT_TYPE,
  TABLE_ROW_HEIGHT_VALUE_MAP,
  TABLE_ROW_HEIGHT_LIST,
  TABLE_TYPES,
  PAGE_HEADER_FOOTER_TYPE,
} from '../constants';
import generatorModel from '../models';

const gettext = window.gettext;

export const parseNumber = (num, digits = 8) => {
  return parseFloat(num.toFixed(digits));
};

const angleToRadian = (angle) => {
  return angle * Math.PI / 180; // π = 180°
};

const sin = (angleRadian) => {
  return parseNumber(Math.sin(angleRadian));
};

const cos = (angleRadian) => {
  return parseNumber(Math.cos(angleRadian));
};

const abs = (num) => {
  return Math.abs(num);
};

const getHypotenuseLength = (width, height) => {
  // Right triangle
  return Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));
};

export const getWidgetCenterCoordinate = (widget) => {
  if (!widget) return { x: 0, y: 0 };

  /*
    convert:
      Given the coordinates A(x, y) of any point on the circle,
      the angle between the diameter of the point and the negative x axis is α,
      the radius r,
      calculate the center coordinates
  */
  const { layout_data } = widget;
  const { x: left, y: top, rotation, width, height } = layout_data;
  const rotationRadian = angleToRadian(rotation);
  const halfOfHypotenuseLength = getHypotenuseLength(width, height) / 2;

  // Math.atan2(height, width): angle between hypotenuse and width
  const angleBetweenPointNegativeX = parseNumber((Math.atan2(height, width) + rotationRadian) % (2 * Math.PI));

  // sin(π - α) = sin(α), cos(π - α) = -cos(α)
  // sin(π + α) = -sin(α), cos(π + α) = -cos(α)
  // sin(2π - α) = -sin(α), cos(2π - α) = cos(α)
  return {
    x: left + halfOfHypotenuseLength * cos(angleBetweenPointNegativeX),
    y: top + halfOfHypotenuseLength * sin(angleBetweenPointNegativeX)
  };
};

export const getRotatedWidgetVertexCoordinate = (widget, widgetCenter) => {
  if (!widget) return [];

  // Calculate the coordinates of the symmetrical point about the center of the circle
  const widgetCenterCoordinate = widgetCenter || getWidgetCenterCoordinate(widget);
  const { x: centerX, y: centerY } = widgetCenterCoordinate;
  const { layout_data } = widget;
  const { rotation, width, height, x: left, y: top } = layout_data;
  const rotationRadian = angleToRadian(rotation);
  const halfOfHypotenuseLength = getHypotenuseLength(width, height) / 2;

  // Math.atan2(height, width): angle between hypotenuse and width
  const angle = Math.atan2(height, width);

  const rotationSubAngle = rotationRadian - angle;

  // left-top
  const leftTop = { x: parseNumber(left, 0), y: parseNumber(top, 0) };

  // right-bottom
  const rightBottom = {
    x: parseNumber(2 * centerX - left, 0),
    y: parseNumber(2 * centerY - top, 0)
  };

  // left-bottom
  let x = parseNumber(centerX - halfOfHypotenuseLength * cos(rotationSubAngle), 0);
  let y = parseNumber(centerY - halfOfHypotenuseLength * sin(rotationSubAngle), 0);
  const leftBottom = {
    x: x,
    y: y
  };

  // right-top
  const rightTop = {
    x: parseNumber(2 * centerX - x, 0),
    y: parseNumber(2 * centerY - y, 0)
  };
  return [leftTop, rightTop, rightBottom, leftBottom];
};

export const getRotatedWidgetHeightAndWidth = (widget, widgetCenter) => {
  if (!widget) return {};
  const vertex = getRotatedWidgetVertexCoordinate(widget, widgetCenter);
  const newWidth = Math.max(abs(vertex[0].x - vertex[2].x), abs(vertex[1].x - vertex[3].x));
  const newHeight = Math.max(abs(vertex[0].y - vertex[2].y), abs(vertex[1].y - vertex[3].y));
  const newX = Math.min(vertex[0].x, vertex[1].x, vertex[2].x, vertex[3].x);
  const newY = Math.min(vertex[0].y, vertex[1].y, vertex[2].y, vertex[3].y);
  return { width: newWidth, height: newHeight, x: newX, y: newY };
};

export const getWidgetColumn = (widget, table) => {
  let widgetKey = widget.key;
  switch (widgetKey) {
    case STATIC_CELL_TYPE.STATIC_TEXT: {
      return { type: widgetKey, key: widgetKey, name: '' };
    }
    case STATIC_CELL_TYPE.STATIC_IMAGE: {
      return { type: widgetKey, key: widgetKey, name: '' };
    }
    case DYNAMIC_CELL_TYPE.CURRENT_DATE: {
      return { type: widgetKey, key: widgetKey, name: '' };
    }
    case DYNAMIC_CELL_TYPE.PAGE_NUMBER: {
      return { type: widgetKey, key: widgetKey, name: '' };
    }
    case DYNAMIC_CELL_TYPE.CURRENT_USER: {
      return { type: widgetKey, key: widgetKey, name: '' };
    }
    case DYNAMIC_CELL_TYPE.TEMPLATE_NAME: {
      return { type: widgetKey, key: widgetKey, name: '' };
    }
    case VIEW_TYPE.ALL_RECORDS_TABLE: {
      return { type: widgetKey, key: widgetKey, name: '' };
    }
    case VIEW_TYPE.VIEW_NAME: {
      return { type: widgetKey, key: widgetKey, name: '' };
    }
    case PAGE_HEADER_FOOTER_TYPE.PAGE_HEADER: {
      return { type: widgetKey, key: widgetKey, name: '' };
    }
    case PAGE_HEADER_FOOTER_TYPE.PAGE_FOOTER: {
      return { type: widgetKey, key: widgetKey, name: '' };
    }
    default: {
      let column = getTableColumnByKey(table, widgetKey);
      if (!column) return {
        type: 'deleted_column',
        key: 'deleted_column',
        name: ''
      };

      const { type } = column;
      if (FORMULA_COLUMN_TYPES.includes(type)) {
        const { data } = column;
        if (!data) return {
          type: 'deleted_column',
          key: 'deleted_column',
          name: ''
        };
        const { result_type, array_type } = data;
        if (result_type === FORMULA_RESULT_TYPE.ARRAY) {
          if (!array_type) return {
            type: 'deleted_column',
            key: 'deleted_column',
            name: ''
          };
        }
      }
      return column;
    }
  }
};

const getValidWidgetByColumn = (widget, column, optionColors) => {
  const { type, data } = column;
  const { config_data: oldConfigData } = widget;
  const newWidget = generatorModel(widget, type, { data, optionColors });
  let newConfigData = newWidget.config_data;
  if (Object.prototype.toString.call(oldConfigData) === '[object Object]') {
    Object.keys(newConfigData).forEach(key => {
      if (Object.prototype.hasOwnProperty.call(oldConfigData, key)) {
        newConfigData[key] = oldConfigData[key];
      }
    });
  }
  return Object.assign({}, newWidget, { config_data: newConfigData });
};

const getNormalizedWidget = (widget, widgetColumn) => {
  const { type } = widgetColumn;
  if (type === 'deleted_column') return widget; // widget column has been deleted
  if (type === widget.type && type !== CellType.LINK) return widget;
  if (type === CellType.LINK && (widget.type === LINK_TABLE || widget.type === CellType.LINK)) {
    return widget;
  }

  // column type is changed
  return getValidWidgetByColumn(widget, widgetColumn, SELECT_OPTION_COLORS);
};

export const getNormalizedPageContent = (pageContent, activeTable) => {
  const { pages = [] } = pageContent;
  const validPages = pages.map(page => {
    const { element_map, _id, element_ids } = page;
    let validElementMap = {};
    let validElementIds = [];
    for (let i = 0; i < element_ids.length; i++) {
      const widgetId = element_ids[i];
      const widget = element_map[widgetId];
      if (!widget) continue;
      validElementIds.push(widgetId);
      const widgetColumn = getWidgetColumn(widget, activeTable);
      const normalizedWidget = getNormalizedWidget(widget, widgetColumn);
      validElementMap[widgetId] = normalizedWidget;
    }
    return {
      _id,
      element_ids: validElementIds,
      element_map: validElementMap
    };
  });
  return {
    ...pageContent,
    pages: validPages,
  };
};

const getCurrentDate = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}-${month > 9 ? month : '0' + month}-${day > 9 ? day : '0' + day}`;
};

export const getWidgetValue = (widget, table, view, row, { linkRows = {}, collaborators = [], pageIdx, pagesCount, pageName } = {}) => {
  let { config_data: configData, key: widgetKey } = widget;
  switch (widgetKey) {
    case STATIC_CELL_TYPE.STATIC_IMAGE: {
      return configData.staticImageUrl;
    }
    case STATIC_CELL_TYPE.STATIC_TEXT: {
      return configData.staticText;
    }
    case DYNAMIC_CELL_TYPE.CURRENT_DATE: {
      const dateString = getCurrentDate();
      const { format } = configData;
      return getDateDisplayString(dateString, { format });
    }
    case DYNAMIC_CELL_TYPE.PAGE_NUMBER: {
      const { format } = configData;
      if (format === '1') return pageIdx;
      if (format === '1-') return `-${pageIdx}-`;
      return pageIdx;
    }
    case DYNAMIC_CELL_TYPE.CURRENT_USER: {
      return window.app.pageOptions.name;
    }
    case DYNAMIC_CELL_TYPE.TEMPLATE_NAME: {
      return pageName || gettext('Unnamed');
    }
    case VIEW_TYPE.ALL_RECORDS_TABLE: {
      return null;
    }
    case VIEW_TYPE.VIEW_NAME: {
      return view ? view.name : gettext('Unnamed');
    }
    case PAGE_HEADER_FOOTER_TYPE.PAGE_HEADER:
    case PAGE_HEADER_FOOTER_TYPE.PAGE_FOOTER: {
      return {
        pageIdx,
        templateName: pageName || gettext('Unnamed'),
        currentUser: window.app.pageOptions.name,
        currentDate: getCurrentDate(),
      };
    }
    default: {
      let column = table.columns.find(column => column.key === widgetKey);

      if (!column) return gettext('Field deleted');

      const { type: columnType, key } = column;
      if (columnType === CellType.LINK) {
        const linkRow = linkRows[row._id] || {};
        return linkRow ? linkRow[key] : [];
      }

      const value = row ? row[key] : '';
      if (columnType === CellType.DIGITAL_SIGN) {
        const { serviceURL } = window.app.config;
        const { dtable_uuid, workspaceID } = window.app.pageOptions;
        const config = {
          server: serviceURL,
          workspaceID: workspaceID,
          dtableUuid: dtable_uuid,
        };
        return getDigitalSignImageUrl(value, config);
      }
      if ([CellType.IMAGE, CellType.FILE].includes(columnType) && configData.display === IMAGE_DISPLAY_TYPE[0]) return value ? [value[0]] : [];
      return value;
    }
  }
};

export const calculateColumnsName = (currentColumns, columnsName) => {
  let newColumnsName = [];
  currentColumns.forEach(column => {
    newColumnsName.push(column.name);
  });
  if (columnsName) {
    const validColumnsName = Array.from(new Set([...columnsName, ...newColumnsName]));
    newColumnsName = validColumnsName.filter(columnName => newColumnsName.some(c => c === columnName));
  }
  return newColumnsName;
};

export const calculateColumns = (columnsName, currentColumns) => {
  let newColumns = [];
  columnsName.forEach(columnName => {
    const column = currentColumns.find(column => columnName === column.name);
    if (column) {
      newColumns.push(column);
    }
  });
  return newColumns;
};

export const getDisplayColumns = (table, widget, isShowIndex, view) => {
  const { config_data, type } = widget;
  if (!TABLE_TYPES.includes(type)) return [];
  const configData = config_data || {};
  const { columnsName = [], unShownColumnNames = [] } = configData.columns || {};
  const columns = view ? getViewShownColumns(view, table.columns) : table.columns;
  if (!Array.isArray(columns) || columns.length === 0) return [];
  const newColumnsName = calculateColumnsName(columns, columnsName || []);
  const validColumns = calculateColumns(newColumnsName, columns);
  let displayColumns = validColumns.filter(column => !unShownColumnNames.find(columnName => column.name === columnName));
  if (isShowIndex) {
    displayColumns.unshift({ type: 'index', key: 'index', width: 40 });
  }
  return displayColumns;
};

export const geTableWidgetRowHeightValue = (rowStyle) => {
  if (!rowStyle) return 32;
  const { rowHeight, customizeRowHeight } = rowStyle || {};
  const validRowHeight = getTableValidRowHeight(rowHeight);
  if (validRowHeight === TABLE_ROW_HEIGHT_TYPE.CUSTOM) {
    return customizeRowHeight === 0 ? 0 : customizeRowHeight;
  }
  if (validRowHeight === TABLE_ROW_HEIGHT_TYPE.AUTO) return 0;
  return TABLE_ROW_HEIGHT_VALUE_MAP[validRowHeight] || 32;
};

export const getTableValidRowHeight = (rowHeight) => {
  if (!rowHeight) return TABLE_ROW_HEIGHT_TYPE.DEFAULT;
  if (TABLE_ROW_HEIGHT_LIST.includes(rowHeight)) return rowHeight;

  // old version
  return TABLE_ROW_HEIGHT_TYPE.CUSTOM;
};

export const getElementByType = (elements, type) => {
  if (!Array.isArray(elements) || elements.length === 0) return [];
  return elements.find(element => element.type === type);
};

export const getElementsByCondition = (elements, condition) => {
  if (!Array.isArray(elements) || elements.length === 0) return [];
  const validCondition = Object.prototype.toString.call(condition) === '[object Function]' ? condition : () => {
    return true;
  };
  return elements.filter(element => validCondition(element));
};

export const getUpdatedWidget = (widget, updateLayoutData, updateConfigData) => {
  return {
    ...widget,
    layout_data: {
      ...widget.layout_data,
      ...updateLayoutData,
    },
    config_data: {
      ...widget.config_data,
      ...updateConfigData,
    }
  };
};

export const getLinkWidgets = (pageContent) => {
  const { pages } = pageContent;
  if (!Array.isArray(pages) || pages.length === 0) return [];
  let linkTableWidgets = [];
  pages.forEach(page => {
    const { element_map } = page;
    Object.values(element_map).forEach(widget => {
      if (widget.type === LINK_TABLE || widget.type === CellType.LINK) {
        if (!linkTableWidgets.find(item => item.key === widget.key)) {
          linkTableWidgets.push(widget);
        }
      }
    });
  });
  return linkTableWidgets;
};

export const isExitViewTableWidget = (pageContent) => {
  if (!pageContent) return false;
  const { pages } = pageContent || {};
  if (pages.length === 0) return false;
  const page = pages.find(page => {
    const { element_map } = page;
    return Object.values(element_map).find(element => element.type === VIEW_TYPE.ALL_RECORDS_TABLE);
  });
  return Boolean(page);
};

export const isArrayFormalColumn = (columnType) => {
  return [
    CellType.IMAGE,
    CellType.FILE,
    CellType.MULTIPLE_SELECT,
    CellType.COLLABORATOR
  ].includes(columnType);
};

export const convertValueToDtableLongTextValue = (value) => {
  const valueType = Object.prototype.toString.call(value);
  if (value && valueType === '[object String]') {
    return { ...getPreviewContent(value), text: value };
  }
  if (valueType === '[object Object]') {
    return value;
  }
  return '';
};

const getTwoDimensionArrayValue = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => {
      if (Object.prototype.toString.call(item) !== '[object Object]') {
        return item;
      }
      if (!Object.prototype.hasOwnProperty.call(item, 'display_value')) return item;
      const { display_value } = item;
      if (!Array.isArray(display_value) || display_value.length === 0) return display_value;
      return display_value.map(i => {
        if (Object.prototype.toString.call(i) === '[object Object]') {
          if (!Object.prototype.hasOwnProperty.call(i, 'display_value')) return i;
          const { display_value } = i;
          return display_value;
        }
        return i;
      });
    });
};

const isValidCellValue = (value) => {
  if (value === undefined) return false;
  if (value === null) return false;
  if (value === '') return false;
  if (JSON.stringify(value) === '{}') return false;
  if (JSON.stringify(value) === '[]') return false;
  return true;
};

export const getFormulaArrayValue = (value, isFlat = true) => {
  if (!Array.isArray(value)) return [];
  if (!isFlat) return getTwoDimensionArrayValue(value);
  return value
    .map(item => {
      if (Object.prototype.toString.call(item) !== '[object Object]') {
        return item;
      }
      if (!Object.prototype.hasOwnProperty.call(item, 'display_value')) return item;
      const { display_value } = item;
      if (!Array.isArray(display_value) || display_value.length === 0) return display_value;
      return display_value.map(i => {
        if (Object.prototype.toString.call(i) === '[object Object]') {
          if (!Object.prototype.hasOwnProperty.call(i, 'display_value')) return i;
          const { display_value } = i;
          return display_value;
        }
        return i;
      });
    })
    .flat()
    .filter(item => isValidCellValue(item));
};

export const getFormulaValue = (formulaColumn, cellValue) => {
  if (!formulaColumn) return '';
  if (!cellValue && cellValue !== 0 && cellValue !== false) return '';
  const { data } = formulaColumn;
  const { array_type } = data || {};
  let value = cellValue;
  if (Array.isArray(cellValue)) {
    value = getFormulaArrayValue(cellValue);
    if (array_type === CellType.LONG_TEXT) {
      return value.map(item => convertValueToDtableLongTextValue(item));
    }
    return value;
  }
  return value;
};

export const getFormulaDisplayString = (cellValue, column, { tables = [], collaborators = [] } = {}) => {
  if (!column) return '';
  const { data: columnData } = column;
  if (!columnData) return '';
  const { result_type } = columnData;
  if (result_type === FORMULA_RESULT_TYPE.NUMBER) {
    return getNumberDisplayString(cellValue, columnData);
  }
  if (result_type === FORMULA_RESULT_TYPE.DATE) {
    return getDateDisplayString(cellValue, columnData);
  }
  if (result_type === FORMULA_RESULT_TYPE.ARRAY) {
    const { array_type, array_data } = columnData;
    if (!array_type && !array_data) return '';
    const arrayColumn = { type: array_type, data: array_data, key: 'array_key' };
    if (!isArrayFormalColumn(array_type) && Array.isArray(cellValue)) {
      if (cellValue.length === 0) return '';
      return cellValue.map((val) => {
        return getCellValueDisplayString({ [arrayColumn.key]: val }, arrayColumn.type, arrayColumn.key, { tables, collaborators });
      }).join(', ');
    }
    return getCellValueDisplayString({ [arrayColumn.key]: cellValue }, arrayColumn.type, arrayColumn.key, { tables, collaborators });
  }
  if (Object.prototype.toString.call(cellValue) === '[object Boolean]') {
    return cellValue + '';
  }
  if (Array.isArray(cellValue)) {
    return cellValue.join(', ');
  }
  return cellValue;
};
