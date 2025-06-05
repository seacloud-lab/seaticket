import React, { Component } from 'react';
import PropTypes from 'prop-types';
import MediaQuery from 'react-responsive';
import { CellType, getLinkedTableID, getTableById, generatorBase64Code } from 'dtable-utils';
import { toaster } from 'dtable-ui-component';
import NewLinkedRecordDialog from './new-linked-record-dialog/index';
import NewLinkedRecordView from './new-linked-record-view';
import { getColumnWidth, getNameValueRow } from '../../../../utils/utils';
import { RowCardItem } from '../../../common/row-cards';
import LinkRecordsPicker from './link-records-picker';
import { Utils, isMobile } from '../../../../../utils/utils';
import eventBus from '../../../../../utils/event-bus';
import Department from '../../../../../models/department';
import { dtableWebAPI } from '../../../../../api/dtable-web-api';
import { enableAddressBookV2 } from '../../../../../utils/constants';
import { getLinkFieldsSettings } from '../../../../../workflow/utils/utils';

const gettext = window.gettext;

const PICKER_HEIGHT = 560;

const propTypes = {
  isReadOnly: PropTypes.bool,
  isEditorShow: PropTypes.bool,
  workflowTaskId: PropTypes.number,
  tables: PropTypes.array,
  value: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  editorConfig: PropTypes.object,
  table: PropTypes.object,
  column: PropTypes.object,
  onCommit: PropTypes.func,
  queryUsers: PropTypes.func,
  collaborators: PropTypes.array,
  canViewFile: PropTypes.bool,
};

const BTN_TYPES_MAP = {
  add_new_record: 'add_new_record',
  link_existed_record: 'link_existed_record',
};

const DEFAULT_LINK_CARD_COLUMN_WIDTH = 100;

class LinkEditor extends Component {

  constructor(props) {
    super(props);
    this.linkID = '';
    this.linkedTableID = '';
    this.linkedViewID = '';
    this.token = '';
    this.linkedTable = null;
    this.linkedTableColumns = [];
    this.nameColumn = {};
    this.cannotModifyRowsIdMap = {};
    this.initLinkConfig(props);
    this.state = {
      isShowNewLinkedRecordDialog: false,
      isShowLinkPicker: false,
      linkedRecords: props.value || [],
      activeLinkedRecord: null,
      focusedBtn: '',
      departments: [],
    };
  }

  componentDidMount() {
    document.addEventListener('keydown', this.onKeyDown);
    this.initDepartmentsList();
  }

  componentWillUnmount() {
    this.linkID = '';
    this.linkedTableID = '';
    this.linkedViewID = '';
    this.token = '';
    this.linkedTable = null;
    this.linkedTableColumns = [];
    this.nameColumn = {};
    document.removeEventListener('keydown', this.onKeyDown);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.isEditorShow !== this.props.isEditorShow) {
      this.setState({ focusedBtn: '' });
    }
  }

  initDepartmentsList = () => {
    const departmentColumn = this.linkedTableColumns.find(column => column.type === CellType.DEPARTMENT_SINGLE_SELECT);
    if (!departmentColumn) return;
    let listDepartmentsAPIName;
    if (enableAddressBookV2) {
      listDepartmentsAPIName = 'listAddressBookV2Departments';
    } else {
      listDepartmentsAPIName = 'listAddressBookDepartments';
    }
    dtableWebAPI[listDepartmentsAPIName]().then((res) => {
      let departments = res.data.departments.map(item => {
        return new Department(item);
      });
      this.setState({ departments: departments });
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  onKeyDown = (e) => {
    const { column, isReadOnly, isEditorShow } = this.props;
    if (isReadOnly) return;
    const { enable_add_new_records: isAddNewRecordBtnShow } = column;
    const isLinkExistedRecordsBtnShow = !!this.selectRecordRef;
    if (e.keyCode === Utils.keyCodes.tab && isEditorShow && (isAddNewRecordBtnShow || isLinkExistedRecordsBtnShow)) {
      e.stopPropagation();
      e.preventDefault();
      let focusedBtn = this.state.focusedBtn;
      if (isAddNewRecordBtnShow && isLinkExistedRecordsBtnShow) {
        switch (focusedBtn) {
          case '': {
            eventBus.dispatch('update-prevent-tab', true);
            focusedBtn = BTN_TYPES_MAP.add_new_record;
            break;
          }
          case BTN_TYPES_MAP.add_new_record: {
            eventBus.dispatch('update-prevent-tab', false);
            focusedBtn = BTN_TYPES_MAP.link_existed_record;
            break;
          }
          default: break;
        }
      } else {
        focusedBtn = isAddNewRecordBtnShow ? BTN_TYPES_MAP.add_new_record : BTN_TYPES_MAP.link_existed_record;
      }
      this.setState({ focusedBtn });
    } else if (e.keyCode === Utils.keyCodes.enter && isEditorShow) {
      const { focusedBtn } = this.state;
      if (focusedBtn === BTN_TYPES_MAP.add_new_record) {
        this.setState({ isShowNewLinkedRecordDialog: true });
      } else if (focusedBtn === BTN_TYPES_MAP.link_existed_record) {
        this.setState({ isShowLinkPicker: true });
      }
    }
  };

  initLinkConfig = (props) => {
    const { table, column, tables, editorConfig, value } = props;
    if (!table) return;
    const currentTableId = table && table._id;
    const { data } = column;
    const { table_id, other_table_id, link_id, is_row_from_view = false, other_view_id = '' } = data || {};
    const linkedViewID = is_row_from_view ? other_view_id : '';
    this.linkID = link_id;
    this.linkedTableID = getLinkedTableID(currentTableId, table_id, other_table_id);
    this.linkedTable = getTableById(tables, this.linkedTableID);
    this.linkedViewID = linkedViewID;
    this.token = editorConfig.token;

    if (!this.linkedTable) return;
    this.linkedTableColumns = this.getLinkedTableColumns();
    this.nameColumn = this.linkedTableColumns.find(column => column.key === '0000');

    if (!Array.isArray(value) || value.length === 0) return;
    value.forEach(item => this.cannotModifyRowsIdMap[item._id] = true);
  };

  getLinkedTableColumns = () => {
    const { linkedTable } = this;
    const linkedTableColumns = linkedTable.columns
      .filter(column => {
        if (column.type === CellType.BUTTON) return false;
        return true;
      })
      .map(column => {
        if (column.type === CellType.LINK) {
          const { data } = column;
          const { display_column_key, array_type, array_data } = data;
          const display_column = {
            key: display_column_key || '0000',
            type: array_type || CellType.TEXT,
            data: array_data || null
          };
          return { ...column, width: getColumnWidth(column), data: { ...data, display_column } };
        }
        return { ...column, width: getColumnWidth(column) };
      });
    return linkedTableColumns;
  };

  getPopoverStyle = () => {
    let position = {};
    let innerHeight = window.innerHeight;
    if (!this.selectRecordRef) return null;
    let { top, left } = this.selectRecordRef.getClientRects()[0];
    const bottom = innerHeight - top;
    const leftValue = left - 100;
    if (top > bottom) {
      const supplementaryDistance = PICKER_HEIGHT - top;
      const bottomValue = supplementaryDistance > 0 ? bottom - supplementaryDistance - 50 : bottom - 50;
      position = { leftValue, bottom: bottomValue };
    } else {
      const supplementaryDistance = PICKER_HEIGHT - bottom;
      const topValue = supplementaryDistance > 0 ? top - supplementaryDistance - 50 : top - 50;
      position = { leftValue, top: topValue };
    }
    return position;
  };

  generatorRecordId = () => {
    const { linkedRecords } = this.state;
    let existIdMap = {};
    linkedRecords.forEach(item => existIdMap[item._id] = true);
    let id = generatorBase64Code(4);
    while (existIdMap[id]) {
      id = generatorBase64Code(4);
    }
    return id;
  };

  getUpdateData = (newRecords) => {
    const { column } = this.props;
    const { linkID, linkedTable, linkedTableColumns } = this;
    const row_datas = newRecords.map(item => {
      // change column.key to column.name
      let newItem = getNameValueRow(linkedTableColumns, item);
      if (item.isExistedLinkRow || this.cannotModifyRowsIdMap[item._id]) newItem._id = item._id;
      return newItem;
    });
    const data = {
      link_id: linkID,
      other_table_name: linkedTable.name,
      row_datas,
    };
    const update = { [column.key]: data };
    return update;
  };

  onClickLinkedRecordBtn = () => {
    const { isReadOnly, column } = this.props;
    const enableAddNewRecords = column['enable_add_new_records'];
    if (isReadOnly || !enableAddNewRecords) return;
    this.toggleNewLinkedRecordDialog();
  };

  toggleNewLinkedRecordDialog = (event) => {
    event && event.stopPropagation();
    this.setState({ isShowNewLinkedRecordDialog: !this.state.isShowNewLinkedRecordDialog });
  };

  toggleLinkedRecordsPicker = () => {
    const { isReadOnly, column } = this.props;
    const enableLinkExistingRecords = column['enable_link_existing_records'];
    if (isReadOnly || !enableLinkExistingRecords) return;
    this.setState({ isShowLinkPicker: !this.state.isShowLinkPicker });
  };

  insertNewLinkedRow = (record) => {
    const { linkedRecords } = this.state;
    let newRecords;
    if (record.isShowTick) {
      const index = linkedRecords.findIndex(item => item._id === record._id);
      newRecords = [...linkedRecords];
      newRecords.splice(index, 1);
    } else if (record._id) {
      record.isExistedLinkRow = true;
      this.cannotModifyRowsIdMap[record._id] = true;
      newRecords = linkedRecords.concat(record);
    } else {
      record._id = this.generatorRecordId();
      newRecords = linkedRecords.concat(record);
    }
    this.setState({
      linkedRecords: newRecords,
      isShowNewLinkedRecordDialog: false,
    }, () => {
      const update = this.getUpdateData(newRecords);
      this.props.onCommit(update);
    });
  };

  clearActiveLinkedRecord = () => {
    this.setState({ activeLinkedRecord: null });
  };

  updateLinkedRow = (record) => {
    const { linkedRecords } = this.state;
    const newRecords = linkedRecords.map(item => {
      if (item._id === record._id) {
        return record;
      }
      return item;
    });
    this.setState({
      linkedRecords: newRecords,
      isShowNewLinkedRecordDialog: false,
    }, () => {
      const update = this.getUpdateData(newRecords);
      this.props.onCommit(update);
    });
  };

  addLinkedRows = (records) => {
    const { linkedRecords } = this.state;
    const linkedRecordIds = linkedRecords.map(record => record._id);
    let newLinkedRecords = linkedRecords.slice(0);
    records.forEach(record => {
      if (!linkedRecordIds.includes(record._id)) {
        record.isExistedLinkRow = true;
        this.cannotModifyRowsIdMap[record._id] = true;
        newLinkedRecords.push(record);
      }
    });
    this.setState({ linkedRecords: newLinkedRecords }, () => {
      const update = this.getUpdateData(newLinkedRecords);
      this.props.onCommit(update);
    });
  };

  onSelectRow = (row) => {
    this.setState({
      activeLinkedRecord: row,
      isShowNewLinkedRecordDialog: true,
    });
  };

  removeLink = (rowId) => {
    const { linkedRecords } = this.state;
    const newRecords = linkedRecords.filter(item => item._id !== rowId);
    this.setState({
      linkedRecords: newRecords,
      isShowLinkPicker: false
    }, () => {
      const update = this.getUpdateData(newRecords);
      this.props.onCommit(update);
    });
  };

  renderLinkRecords = () => {
    const { linkedRecords, departments } = this.state;
    const { column, collaborators, editorConfig, isReadOnly } = this.props;
    const { linkVisibleFields } = getLinkFieldsSettings(column);
    const columns = this.linkedTableColumns.filter(column =>
      column.key !== this.nameColumn.key && linkVisibleFields.includes(column.key)
    ).map(column => Object.assign({}, column, { width: DEFAULT_LINK_CARD_COLUMN_WIDTH }));
    return (
      <>
        {linkedRecords.map((row, rowIdx) => {
          return (
            <RowCardItem
              key={`row-card-${rowIdx}`}
              isShowRemoveCardItemBtn={isReadOnly ? false : true}
              isHighlightRow={false}
              isShowColumnName={true}
              row={row}
              rowIdx={rowIdx}
              nameColumn={this.nameColumn}
              departments={departments}
              collaborators={collaborators}
              columns={columns}
              removeCardItem={this.removeLink}
              onSelectRow={this.onSelectRow}
              queryUsers={this.props.queryUsers}
              editorConfig={editorConfig}
            />
          );
        })}
      </>
    );
  };

  render() {
    const { column, tables, editorConfig, workflowTaskId, collaborators, canViewFile } = this.props;
    const { isShowNewLinkedRecordDialog, isShowLinkPicker, linkedRecords, activeLinkedRecord, focusedBtn, departments } = this.state;
    const { enable_add_new_records: enableAddNewRecords, enable_link_existing_records: enableLinkExistingRecords,
      enable_customize_new_link_btn_name: enableNewLinkBtnName, enable_customize_existing_link_btn_name: enableExistingBtnName,
      new_link_btn_name: newLinkBtnName, existing_link_btn_name: existingLinkBtnName, link_at_most_one_record: linkAtMostOneRecord } = column;
    const isEditorReadOnly = activeLinkedRecord ? this.cannotModifyRowsIdMap[activeLinkedRecord._id] : false;

    return (
      <div className='w-100'>
        <div className="d-flex">
          {!(linkAtMostOneRecord && linkedRecords.length > 0) &&
            <>
              {enableAddNewRecords &&
                <div
                  className={`select-editor-add ${focusedBtn === BTN_TYPES_MAP.add_new_record && 'focus'}`}
                  onClick={this.onClickLinkedRecordBtn}
                >
                  {(enableNewLinkBtnName && newLinkBtnName) ? newLinkBtnName : gettext('Add record')}
                </div>
              }
              {enableLinkExistingRecords &&
                <div
                  className={`select-editor-add ${enableAddNewRecords ? 'ml-3' : ''} ${focusedBtn === BTN_TYPES_MAP.link_existed_record && 'focus'}`}
                  onClick={this.toggleLinkedRecordsPicker}
                  ref={ref => this.selectRecordRef = ref}
                >
                  {(enableExistingBtnName && existingLinkBtnName) ? existingLinkBtnName : gettext('Link existing records')}
                </div>
              }
            </>
          }
        </div>
        <div className="workflow-link-records-container mt-3">
          {this.renderLinkRecords()}
        </div>
        <MediaQuery query="(min-width: 767.8px)">
          {isShowNewLinkedRecordDialog && (
            <NewLinkedRecordDialog
              isReadOnly={isEditorReadOnly}
              column={column}
              editorConfig={editorConfig}
              tables={tables}
              table={this.linkedTable}
              activeLinkedRow={activeLinkedRecord}
              columns={this.linkedTableColumns}
              collaborators={collaborators}
              onToggle={this.toggleNewLinkedRecordDialog}
              insertNewLinkedRow={this.insertNewLinkedRow}
              updateLinkedRow={this.updateLinkedRow}
              clearActiveLinkedRecord={this.clearActiveLinkedRecord}
              canViewFile={canViewFile}
            />
          )}
        </MediaQuery>
        <MediaQuery query="(max-width: 767.8px)">
          {isShowNewLinkedRecordDialog && (
            <NewLinkedRecordView
              isReadOnly={isEditorReadOnly}
              column={column}
              editorConfig={editorConfig}
              tables={tables}
              table={this.linkedTable}
              columns={this.linkedTableColumns}
              collaborators={collaborators}
              activeLinkedRow={activeLinkedRecord}
              insertNewLinkedRow={this.insertNewLinkedRow}
              updateLinkedRow={this.updateLinkedRow}
              onToggle={this.toggleNewLinkedRecordDialog}
              clearActiveLinkedRecord={this.clearActiveLinkedRecord}
            />
          )}
        </MediaQuery>
        {isShowLinkPicker && !(linkedRecords.length > 0 && linkAtMostOneRecord) &&
          <LinkRecordsPicker
            nameColumn={this.nameColumn}
            column={column}
            departments={departments}
            columns={this.linkedTableColumns}
            workflowTaskId={workflowTaskId}
            token={this.token}
            collaborators={collaborators}
            linkedRecords={linkedRecords}
            insertNewLinkedRow={this.insertNewLinkedRow}
            addLinkedRows={this.addLinkedRows}
            popoverStyle={(isShowLinkPicker && !isMobile) ? this.getPopoverStyle() : null}
            onClickOutside={this.toggleLinkedRecordsPicker}
            editorConfig={editorConfig}
          />
        }
      </div>
    );
  }
}

LinkEditor.propTypes = propTypes;

export default LinkEditor;
