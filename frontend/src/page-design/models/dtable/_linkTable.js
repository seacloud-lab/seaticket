import { TABLE_ROW_HEIGHT_TYPE, BACKGROUND, DEFAULT_TABLE_HEADER_BACKGROUND_COLOR } from '../../constants';

const DEFAULT_DATA = {
  width: 500,
  height: 300,
  rotation: 0,
  x: 0,
  y: 0,
  zIndex: 7
};

class _LinkTable {

  constructor(object) {
    // init identification attributes
    const { id, key, type, layout_data, is_locked } = object;
    this.id = id;
    this.key = key;
    this.type = type;
    this.is_locked = is_locked || false;

    // init base properties
    this.layout_data = Object.assign({}, DEFAULT_DATA, layout_data);

    // init style properties
    this.config_data = {
      showRowNumber: true,
      applyBandedTableDesign: true,
      showRowStart: 0,
      showRowEnd: undefined,
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
        lineHeight: 1.5,
        fontWeight: 400,
        rowHeight: TABLE_ROW_HEIGHT_TYPE.CUSTOM,
        customizeRowHeight: 32,
      },
      rowStyle: {
        font: 'Arial',
        fontSize: 14,
        lineHeight: 1.5,
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
  }

}

export default _LinkTable;
