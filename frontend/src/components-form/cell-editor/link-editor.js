import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import MediaQuery from 'react-responsive';
import { CellType, getLinkedTableID, getTableById, getCellValueDisplayString } from 'dtable-utils';
import { toaster, ClickOutside } from 'dtable-ui-component';
import { dtableWebAPI } from '../../api/dtable-web-api';
import { Utils } from '../../utils/utils';
import LinkEditorItems from '../cell-editor-widgets/link-editor/link-editor-items';
import LinkRecordsPicker from '../cell-editor-widgets/link-editor/link-records-picker';
import LinkSelectView from '../cell-viewer-mobile/link-select-view';

import '../cell-css/link-editor.css';

const propTypes = {
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  isEditFormPage: PropTypes.bool,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.array]), // value linked rows_ids
  column: PropTypes.object,
  onCommit: PropTypes.func,
  isEditorShow: PropTypes.bool,
  updateTabIndex: PropTypes.func
};

const gettext = window.gettext;
const POPOVER_MAX_HEIGHT = 200;

const { dtableMetadata, formConfig, token } = window.shared.pageOptions;

class LinkEditor extends React.Component {

  static defaultProps = {
    value: []
  };

  constructor(props) {
    super(props);

    if (!props.isReadOnly) {
      this.linkedTable = this.getLinkedTable();
      this.linkColumn = this.getLinkedColumn(props.column, this.linkedTable);
      const { is_multiple = true } = (props.column && props.column.data) || {};
      this.state = {
        linkRowData: [],
        linkRecords: [],
        displayRecords: [],
        isShowLinkPicker: false,
      };
      this.searchValue = '';
      this.isMultiple = is_multiple;
      this.linked_ids_map = {};
      this.tables = [];
    }
  }

  componentDidMount() {
    const { column, isEditFormPage } = this.props;
    if (isEditFormPage) return;
    const customUrl = '';
    dtableWebAPI.getFormLinkedRows(customUrl, token, column.key).then(res => {
      const linkRecords = res.data.linked_table_rows;
      const displayRecords = linkRecords.slice(0, 10);
      this.setState({ linkRecords, displayRecords });
    }).catch(err => {
      const errMessage = Utils.getErrorMsg(err);
      toaster.danger(errMessage);
    });
    document.addEventListener('keydown', this.onKeyDown);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onKeyDown);
  }

  onKeyDown = (event) => {
    event.stopPropagation();
    if (!this.props.isEditorShow) return;
    if (event.keyCode === Utils.keyCodes.enter) {
      this.setState({ isShowLinkPicker: true });
    } else if (event.keyCode === Utils.keyCodes.esc) {
      this.setState({ isShowLinkPicker: false });
    }
  };

  onClickOutside = (e) => {
    if (this.state.isShowLinkPicker && !this.editorContainer.contains(e.target)) {
      this.setState({ isShowLinkPicker: false });
    }
  };

  initDisplayRecords = () => {
    const { linkRecords } = this.state;
    const displayRecords = linkRecords.slice(0, 10);
    this.setState({ displayRecords });
  };

  getLinkedTable = () => {
    const { column } = this.props;
    const { table_id, other_table_id } = (column && column.data) || {};
    const { metadata } = JSON.parse(dtableMetadata);
    const tables = metadata.tables;
    this.tables = tables;
    const { table_id: currentTableId } = JSON.parse(formConfig);
    const linkedTableID = getLinkedTableID(currentTableId, table_id, other_table_id);
    const linkedTable = getTableById(tables, linkedTableID);
    return linkedTable;
  };

  getLinkedColumn = (column, linkedTable) => {
    if (!linkedTable) return '';
    const { display_column_key = '0000' } = column.data;
    return linkedTable.columns.find(column => column.key === display_column_key);
  };

  getRowDataItem = (row) => {
    this.linked_ids_map[row._id] = true;
    return {
      _id: row._id,
      name: row[this.linkColumn.key]
    };
  };

  getNewLinkRecords = (searchValue) => {
    const { linkRecords } = this.state;
    if (linkRecords.length === 0) return [];
    if (!searchValue) return linkRecords.slice(0, 10);

    const { key, type, data } = this.linkColumn;
    // Preview form page does not support formulaRows, getCellValueDisplayString is not useful, so search linkRecord value
    if (type === CellType.FORMULA || type === CellType.LINK_FORMULA) {
      return linkRecords.filter((row) => {
        const name = row[key];
        return name ? name.toLowerCase().indexOf(searchValue.toLowerCase()) > -1 : false;
      });
    }
    return linkRecords.filter((row) => {
      const formattedCellValue = getCellValueDisplayString(row, type, key, { tables: this.tables, data });
      if (!formattedCellValue || formattedCellValue.trim() === '') {
        return false;
      }
      return formattedCellValue.toLowerCase().indexOf(searchValue.toLowerCase()) > -1;
    });
  };

  onSearch = (searchValue) => {
    this.searchValue = searchValue;
    const displayRecords = this.getNewLinkRecords(searchValue);
    this.setState({ displayRecords });
  };

  updateLinkRows = (record) => {
    const { linkRowData } = this.state;
    let newLinkRowData = [];
    if (this.linked_ids_map[record._id]) {
      delete this.linked_ids_map[record._id];
      newLinkRowData = linkRowData.slice(0);
      const index = newLinkRowData.findIndex(row => row._id === record._id);
      newLinkRowData.splice(index, 1);
    } else {
      if (this.isMultiple) {
        newLinkRowData = [...linkRowData, this.getRowDataItem(record)];
      } else {
        newLinkRowData = [this.getRowDataItem(record)];
        this.linked_ids_map = { [record._id]: true };
      }
    }
    this.setState({
      linkRowData: newLinkRowData,
    }, this.commitValue);
  };

  removeLink = (rowData) => {
    const { linkRowData } = this.state;
    const newLinkRowData = linkRowData.filter(item => item._id !== rowData._id);
    delete this.linked_ids_map[rowData._id];

    this.setState({
      linkRowData: newLinkRowData,
    }, this.commitValue);
  };

  commitValue = () => {
    const { column } = this.props;
    const { linkRowData } = this.state;
    const rows_ids = linkRowData.map(row => row._id);
    const updated = {
      [column.key]: {
        column: column,
        other_rows_ids: rows_ids
      }
    };
    this.props.onCommit(updated);
  };

  onLinkPickerToggle = () => {
    this.setState({ isShowLinkPicker: !this.state.isShowLinkPicker });
  };

  calculatePopoverPosition = () => {
    if (!this.editorContainer) return;
    let innerHeight = window.innerHeight;
    let { top, left, height } = this.editorContainer.getClientRects()[0];
    let isBelow = (innerHeight - (top + height)) > POPOVER_MAX_HEIGHT;
    let position = { top: (top + height + 1), left: left };
    if (!isBelow) {
      let bottom = innerHeight - top;
      position = { bottom: bottom, left: left };
    }
    return position;
  };

  getPopoverStyle = () => {
    let position = this.calculatePopoverPosition();
    return Object.assign({}, { position: 'absolute' }, { ...position });
  };

  scrollToMore = (recordsListRef, recordsContentRef) => {
    if (this.searchValue || !recordsListRef || !recordsContentRef) return;
    let { displayRecords: currentDisplayRecords, linkRecords } = this.state;
    let currentDisplayRecordsCount = currentDisplayRecords.length;
    let { offsetHeight, scrollTop } = recordsListRef;
    if (currentDisplayRecordsCount >= linkRecords.length) return;
    if (offsetHeight + scrollTop + 10 >= recordsContentRef.offsetHeight) {
      let displayRecords = linkRecords.slice(currentDisplayRecordsCount, currentDisplayRecordsCount + 10);
      this.setState({ displayRecords: currentDisplayRecords.concat(...displayRecords) });
    }
  };

  setEditorContainerRef = (ref) => {
    this.editorContainer = ref;
  };

  renderEditor = () => {
    const { isReadOnly, isEditorShow, isRequired } = this.props;
    if (isReadOnly) {
      return (
        <div
          className="link-editor-container"
          aria-label={isRequired ? gettext('Choose option') + ', ' + gettext('Required') : gettext('Choose option')}
          tabIndex={0}
        >
          <span className="add-link-record user-select-none">
            {gettext('Choose option')}
          </span>
        </div>
      );
    }
    const { linkRowData, displayRecords, isShowLinkPicker } = this.state;
    const popoverStyle = this.getPopoverStyle();

    if (!this.linkedTable || !this.linkColumn) {
      return (
        <div
          className="link-editor-container"
          tabIndex={0}
          aria-label={isRequired ? gettext('Choose option') + ', ' + gettext('Required') : gettext('Choose option')}
        >
          <div className="link-error-tips">
            {gettext('Link table is deleted, unable to add related content.')}
          </div>
        </div>
      );
    }

    const NOT_SUPPORT = [CellType.CREATOR, CellType.LAST_MODIFIER];
    if (NOT_SUPPORT.includes(this.linkColumn.type)) {
      return <div className="err-message">{gettext('Cannot display creator column or last modifier column')}</div>;
    }

    return (
      <Fragment>
        <MediaQuery query="(min-width: 768px)">
          <ClickOutside onClickOutside={this.onClickOutside}>
            <div
              className={`link-editor-container ${isEditorShow && 'focus'}`}
              ref={this.setEditorContainerRef}
              onClick={this.onLinkPickerToggle}
              tabIndex={0}
              aria-label={isRequired ? gettext('Choose option') + ', ' + gettext('Required') : gettext('Choose option')}
            >
              {linkRowData.length === 0 ? (
                <span className="add-link-record user-select-none">
                  {gettext('Choose option')}
                </span>
              ) : (
                <LinkEditorItems linkColumn={this.linkColumn} items={linkRowData} removeLink={this.removeLink} />
              )}
              {isShowLinkPicker && (
                <LinkRecordsPicker
                  popoverStyle={popoverStyle}
                  linkColumn={this.linkColumn}
                  records={displayRecords}
                  linkedIdsMap={this.linked_ids_map}
                  scrollToMore={this.scrollToMore}
                  initDisplayRecords={this.initDisplayRecords}
                  updateLinkRows={this.updateLinkRows}
                  onSearch={this.onSearch}
                  closeEditor={this.onLinkPickerToggle}
                />
              )}
            </div>
          </ClickOutside>
        </MediaQuery>
        <MediaQuery query="(max-width: 767.8px)">
          <div className="link-editor-container"
            ref={this.setEditorContainerRef}
            onClick={this.onLinkPickerToggle}
            tabIndex={0}
            aria-label={isRequired ? gettext('Choose option') + ', ' + gettext('Required') : gettext('Choose option')}
          >
            {linkRowData.length === 0 ? (
              <span className="add-link-record user-select-none">
                {gettext('Choose option')}
              </span>
            ) : (
              <LinkEditorItems linkColumn={this.linkColumn} items={linkRowData} removeLink={this.removeLink} />
            )}
            {isShowLinkPicker && (
              <LinkSelectView
                column={this.props.column}
                linkColumn={this.linkColumn}
                records={displayRecords}
                linkedIdsMap={this.linked_ids_map}
                updateLinkRows={this.updateLinkRows}
                onSearch={this.onSearch}
                scrollToMore={this.scrollToMore}
                closeEditor={this.onLinkPickerToggle}
              />
            )}
          </div>
        </MediaQuery>
      </Fragment>
    );
  };

  render() {
    return (
      <div className="cell-editor grid-cell-type-text">
        {this.renderEditor()}
      </div>
    );
  }
}

LinkEditor.propTypes = propTypes;

export default LinkEditor;
