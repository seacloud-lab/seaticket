import { TABLE_ROW_HEIGHT_TYPE, BACKGROUND, DEFAULT_TABLE_HEADER_BACKGROUND_COLOR } from '../../constants';

const DEFAULT_LAYOUT_DATA = {
  width: 500,
  height: 300,
  rotation: 0,
  x: 0,
  y: 0,
  zIndex: 7
};

const DEFAULT_CONFIG_DATA = {
  showRowNumber: true,
  applyBandedTableDesign: true,
  showRowStart: 0,
  showRowEnd: undefined,
  select_column_display_option_color: true,
  expand_display_area: {
    is_expand: false,
    style: {
      margin_top: 0,
      margin_bottom: 0,
    },
  },
  columns: {
    columnsName: [], // order
    unShownColumnNames: [], // don't show
    columnWidthMap: {},
  },
  titleStyle: {
    is_show: true,
    background: BACKGROUND[1],
    background_color: DEFAULT_TABLE_HEADER_BACKGROUND_COLOR,
    font: 'Arial',
    fontSize: 14,
    lineHeight: 1.5, // fixed
    fontWeight: 400,
    rowHeight: TABLE_ROW_HEIGHT_TYPE.CUSTOM,
    customizeRowHeight: 32,
  },
  rowStyle: {
    font: 'Arial',
    fontSize: 14,
    lineHeight: 1.5, // fixed
    fontWeight: 400,
    rowHeight: TABLE_ROW_HEIGHT_TYPE.CUSTOM,
    customizeRowHeight: 32,
  },
  border: {
    outside: {
      hide: false,
      color: '#ccc',
      width: 1,
    },
    horizontal: {
      hide: false,
      color: '#ccc',
      width: 1,
    },
    vertical: {
      hide: false,
      color: '#ccc',
      width: 1,
    },
  },
};

class ViewAllRecordsTable {

  constructor(object) {
    // init identification attributes
    const { id, key, type, layout_data, is_locked, config_data } = object;
    this.id = id;
    this.key = key;
    this.type = type;
    this.is_locked = is_locked || false;

    // init base properties
    this.layout_data = Object.assign({}, DEFAULT_LAYOUT_DATA, layout_data);

    // init style properties
    this.config_data = { ...DEFAULT_CONFIG_DATA, ...config_data };
  }

}

export default ViewAllRecordsTable;
