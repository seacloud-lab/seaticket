import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { DTableModalHeader, toaster } from 'dtable-ui-component';
import { Modal, ModalBody, ModalFooter, Button, TabContent, TabPane, Nav, NavItem, NavLink } from 'reactstrap';
import { COLUMNS_ICON_CONFIG, CellType, DateUtils, getNumberDisplayString } from 'dtable-utils';
import { getPreviewContent } from '@seafile/seafile-editor';
import { gettext } from '../../../utils/constants';
import { Utils } from '../../../utils/utils';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import Loading from '../../../components/loading';
import { formatDateValue, getFileIconUrl } from '../../../components-form/utils/utils';
import ExcelImportAdjust from './dtable-excel-preview-widgets/excel-import-adjust';

import '../../../css/dtable-excel-preview-dialog.css';

const { mediaUrl } = window.app.config;

const propTypes = {
  toggle: PropTypes.func.isRequired,
  excelInfo: PropTypes.object.isRequired,
  importExcelCSV: PropTypes.func.isRequired,
  fileType: PropTypes.string.isRequired,
};

class DTableExcelPreviewDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      tables: [],
      tableIndex: 0,
      totalRowNumber: 0,
      workspace_id: props.excelInfo.workspace_id,
      dtable_name: props.excelInfo.dtable_name,
      includedTables: [],
      tableIncludedColumns: {},
      isShowImportSelect: true,
    };
  }

  componentDidMount() {
    this.previewExcelCSV();
  }

  toggle = () => {
    this.props.toggle();
  };

  onChangeTable = (tableIndex) => {
    this.setState({ tableIndex: tableIndex });
  };

  toggleImportSelect = () => {
    this.setState({
      isShowImportSelect: !this.state.isShowImportSelect,
    });
  };

  onSubmit = () => {
    let { workspace_id, dtable_name, includedTables, tableIncludedColumns } = this.state;
    this.toggle();
    let newIncludedTables = {};
    includedTables.forEach(table_name => {
      newIncludedTables[table_name] = tableIncludedColumns[table_name];
    });
    this.props.importExcelCSV(workspace_id, dtable_name, newIncludedTables);
  };

  onCancel = () => {
    let { workspace_id, dtable_name } = this.state;
    dtableWebAPI.importExcelCSVCancel(workspace_id, dtable_name, this.props.fileType).then((res) => {
      this.toggle();
    }).catch((error) => {
      this.handleError(error);
      this.toggle();
    });

  };

  previewExcelCSV = () => {
    let { workspace_id, dtable_name } = this.state;
    dtableWebAPI.importExcelCSVPreview(workspace_id, dtable_name).then((res) => {
      const { tables } = res.data;
      const totalRowNumber = tables.reduce((a, b) => {
        return a + b.max_row;
      }, 0);
      let tableIncludedColumns = {};
      let columnNames = [];
      tables.forEach(table => {
        let { columns } = table;
        columnNames = columns.map(column => {return column.name;});
        tableIncludedColumns[table.name] = columnNames;
      });
      this.setState({
        tables,
        totalRowNumber,
        includedTables: tables.map(table => {return table.name;}),
        isLoading: false,
        tableIncludedColumns: tableIncludedColumns,
      });
    }).catch((error) => {
      this.handleError(error);
      this.toggle();
    });
  };

  getCurrentTableMaxRowNum = () => {
    const { tableIndex, tables } = this.state;
    if (tables.length === 0) return 0;
    const currentTable = tables[tableIndex];
    return currentTable?.max_row;
  };

  handleError = (e) => {
    let errMessage = Utils.getErrorMsg(e);
    toaster.danger(errMessage);
  };

  onCheckTable = (tableName, is_checked) => {
    const { includedTables, tables, tableIndex } = this.state;
    let newIncludedTables = [...includedTables];
    if (!is_checked) {
      newIncludedTables.push(tableName);
    } else {
      newIncludedTables = newIncludedTables.filter(name => name !== tableName);
    }
    const totalRowNumber = tables.filter(table => newIncludedTables.includes(table.name))
      .reduce((a, b) => { return a + b.max_row; }, 0);
    this.setState({ includedTables: newIncludedTables, totalRowNumber }, () => {
      if (tables[tableIndex].name === tableName) {
        this.onChangeTable(0);
      }
    });
  };

  checkAllTable = () => {
    const { tables } = this.state;
    const includedTables = tables.map(item => item.name);
    const totalRowNumber = tables.reduce((a, b) => { return a + b.max_row; }, 0);
    this.setState({ includedTables, totalRowNumber });
  };

  uncheckAllTable = () => {
    const firstTable = this.state.tables[0];
    const totalRowNumber = firstTable.max_row;
    this.setState({ includedTables: [firstTable.name], totalRowNumber, tableIndex: 0 });
  };

  onCheckColumn = (table_name, column, is_checked) => {
    let column_name = column.name;
    let tableIncludedColumns = this.state.tableIncludedColumns;
    let includedColumns = tableIncludedColumns[table_name];
    if (!is_checked) {
      includedColumns.push(column_name);
      tableIncludedColumns[table_name] = includedColumns;
      this.setState({ tableIncludedColumns: tableIncludedColumns });
    } else {
      includedColumns = includedColumns.filter(name => name !== column_name);
      tableIncludedColumns[table_name] = includedColumns;
      this.setState({ tableIncludedColumns: tableIncludedColumns });
    }
  };

  checkSubmit = (includedTables, tableIncludedColumns) => {
    let hasEmptyTable = false;
    for (let key in includedTables) {
      if (Object.prototype.hasOwnProperty.call(includedTables, key)) {
        let table_name = includedTables[key];
        let columns = tableIncludedColumns[table_name];
        if (columns.length === 0) {
          hasEmptyTable = true;
          break;
        }
      }
    }
    return !hasEmptyTable && includedTables.length;
  };

  checkAllField = () => {
    let table = this.state.tables[this.state.tableIndex];
    let columns = table.columns;
    let tableIncludedColumns = this.state.tableIncludedColumns;
    tableIncludedColumns[table.name] = columns.map(item => item.name);
    this.setState({ tableIncludedColumns: tableIncludedColumns });
  };

  uncheckAllField = () => {
    let table = this.state.tables[this.state.tableIndex];
    let tableIncludedColumns = this.state.tableIncludedColumns;
    tableIncludedColumns[table.name] = [table.columns[0].name];
    this.setState({ tableIncludedColumns: tableIncludedColumns });
  };

  render() {
    let { isLoading, tables, tableIndex, includedTables, tableIncludedColumns } = this.state;
    let canSubmit = this.checkSubmit(includedTables, tableIncludedColumns);
    const currentTableMaxRowNum = this.getCurrentTableMaxRowNum();

    return (
      <Modal className="dtable-excel-preview-dialog" isOpen={true} size="lg" toggle={this.onCancel}>
        {this.props.fileType === 'xlsx' && <DTableModalHeader toggle={this.onCancel}>{gettext('Import from xlsx')}</DTableModalHeader>}
        {this.props.fileType === 'csv' && <DTableModalHeader toggle={this.onCancel}>{gettext('Import from csv')}</DTableModalHeader>}
        <ModalBody>
          {isLoading ?
            <Loading /> :
            <Fragment>
              <ExcelImportAdjust
                tables={tables}
                tableIndex={tableIndex}
                includedTables={includedTables}
                tableIncludedColumns={tableIncludedColumns}
                onCheckColumn={this.onCheckColumn}
                onCheckTable={this.onCheckTable}
                checkAllTable={this.checkAllTable}
                uncheckAllTable={this.uncheckAllTable}
                checkAllField={this.checkAllField}
                uncheckAllField={this.uncheckAllField}
                toggleImportSelect={this.toggleImportSelect}
                isShowImportSelect={this.state.isShowImportSelect}
              />
              <p className='seatable-tip-large'>
                {currentTableMaxRowNum > 200 ?
                  gettext('{currentTableMaxRowNum} rows will be imported for this table. This is a preview, only 200 rows are shown.').replace('{currentTableMaxRowNum}', currentTableMaxRowNum) :
                  gettext('{currentTableMaxRowNum} rows will be imported for this table.').replace('{currentTableMaxRowNum}', currentTableMaxRowNum)
                }
              </p>
              <Nav tabs className="dtable-excel-preview-dialog-nav">
                {tables.map((table, index) => {
                  if (!includedTables.includes(table.name)) return null;
                  return (
                    <NavItem key={index}>
                      <NavLink
                        className={classnames({ active: index === tableIndex })}
                        onClick={() => { this.onChangeTable(index); }}
                      >
                        {table.name}
                      </NavLink>
                    </NavItem>
                  );
                })}
              </Nav>
              <TabContent
                activeTab={tableIndex}
                className="dtable-excel-preview-dialog-tab-content"
                style={{ height: `calc(100% - ${(this.state.isShowImportSelect ? 180 : 130)}px)` }}
              >
                {tables.map((table, index) => {
                  return (
                    <TabPane tabId={index} key={index}>
                      <Content
                        tableData={table}
                        onCheckColumn={this.onCheckColumn}
                        includedColumns={tableIncludedColumns[table.name]}
                      />
                    </TabPane>
                  );
                })}
              </TabContent>
            </Fragment>
          }
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.onCancel}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.onSubmit} disabled={!canSubmit}>{gettext('Import')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

DTableExcelPreviewDialog.propTypes = propTypes;

// copy from dataset-dialog
function Content({ tableData, onCheckColumn, includedColumns }) {
  const { rows, columns } = tableData;
  return (
    <table>
      <thead>
        <tr>
          {columns.map((column, index) => {
            const { type, name } = column;
            const columnType = type || 'default';
            if (columnType === 'link' || (includedColumns && !includedColumns.includes(name))) return null;
            return (
              <th key={index} className="text-truncate">
                <span className="header-icon">
                  <i className={COLUMNS_ICON_CONFIG[columnType]}></i>
                </span>
                <span className="header-name" title={name}>{name}</span>
              </th>
            );
          })}
        </tr>
      </thead>
      {rows &&
        <tbody>
          {rows.map((row, index) => {
            return (
              <Item
                key={index}
                index={index}
                row={row}
                tableData={tableData}
                includedColumns={includedColumns}
              />
            );
          })}
        </tbody>
      }
    </table>
  );
}

Content.propTypes = {
  tableData: PropTypes.object.isRequired,
  includedColumns: PropTypes.array,
  onCheckColumn: PropTypes.func,
};

export { Content };

function getOptionIdByName(column, optionName) {
  if (!column.data) return null;
  const options = column.data.options;
  let option = options.find(item => { return item.name === optionName; });
  return option || null;
}

function renderLongTextImages(images) {
  let imagesDom = images.map((image, index) => {
    return <img src={Utils.getImageThumbnailUrl(image)} alt="" key={index} />;
  });
  return (
    <span className="longtext-icon-container longtext-formatter-image-container">
      {imagesDom}<i className="image-number">{'+'}{images.length}</i>
    </span>
  );
}

function renderLongText(markdown) {
  const { previewText, images, links } = getPreviewContent(markdown);
  const linksLen = links ? links.length : 0;
  const imagesLen = images ? images.length : 0;
  return (
    <div className="longtext-formatter">
      {linksLen > 0 &&
        <span className="longtext-icon-container longtext-formatter-links-container">
          <i className="dtable-font dtable-icon-url"></i>{links.length}
        </span>
      }
      {imagesLen > 0 && renderLongTextImages(images)}
      <span className="longtext-formatter-preview-container">{previewText}</span>
    </div>
  );
}

function renderCollaborators(cellValue, related_user_list) {
  let collaborators = [];
  cellValue.forEach((email, index) => {
    const user = related_user_list.find(user => user.email === email);
    if (user) {
      collaborators.push(
        <div className="collaborator" key={index}>
          <span className="collaborator-avatar-container">
            <img className="collaborator-avatar" alt={user.name} src={user.avatar_url} />
          </span>
          <span className="collaborator-name">{user.name}</span>
        </div>
      );
    }
  });
  return (
    <div className="collaborators-formatter">
      <div className="formatter-show">{collaborators}</div>
    </div>
  );
}

function renderDate(cellValue, data) {
  const format = (data && data.format) ? data.format : 'YYYY-MM-DD HH:mm';
  const dateObject = DateUtils.getValidDate(cellValue);
  const formattedDate = dateObject ? formatDateValue(cellValue, format) : dateObject;
  return <div className="text-end text-formatter">{formattedDate}</div>;
}

function renderNumber(cellValue, data) {
  return <div className="text-end">{getNumberDisplayString(cellValue, data)}</div>;
}

function renderImage(cellValue) {
  let imagesArr = [];
  cellValue.forEach((item, index) => {
    imagesArr.push(<img src={Utils.getImageThumbnailUrl(item)} alt='' width='28px' key={index}></img>);
  });
  return <div className="image-formatter">{imagesArr}</div>;
}

function renderFile(cellValue) {
  let filesArr = [];
  if (Array.isArray(cellValue)) {
    filesArr = cellValue.map((item, index) => {
      return <img key={index} src={getFileIconUrl(mediaUrl, item.name, item.type)} title={item.name} alt='' />;
    });
  }
  return <div className="file-formatter">{filesArr}</div>;
}

function renderSingleSelect(column, cellValue) {
  const option = getOptionIdByName(column, cellValue);
  const { name, color } = option;
  return <div><div className="single-select" style={{ backgroundColor: color }}>{name}</div></div>;
}

function covertRow(row, column, related_user_list) {
  if (!row || !column) {
    return null;
  }
  const { name, type, data } = column;
  const cellValue = row[name];
  if (!cellValue && typeof cellValue !== 'number') {
    return null;
  }
  let result;
  switch (type) {
    case CellType.TEXT:
      result = <div className="text-formatter">{cellValue}</div>;
      break;
    case CellType.LONG_TEXT:
      result = renderLongText(cellValue.text);
      break;
    case CellType.IMAGE:
      result = renderImage(cellValue);
      break;
    case CellType.FILE:
      result = renderFile(cellValue);
      break;
    case CellType.COLLABORATOR:
      result = renderCollaborators(cellValue, related_user_list);
      break;
    case CellType.SINGLE_SELECT:
      result = renderSingleSelect(column, cellValue);
      break;
    case CellType.MULTIPLE_SELECT:
      result = renderLongText(cellValue.toString());
      break;
    case CellType.LINK:
      break;
    case CellType.DATE:
      result = renderDate(cellValue, data);
      break;
    case CellType.NUMBER:
      result = renderNumber(cellValue, data);
      break;
    case CellType.CHECKBOX:
      if (cellValue) {
        result = <input className="checkbox ml-4 mt-1" type="checkbox" readOnly defaultChecked></input>;
      } else {
        result = <input className="checkbox ml-4 mt-1" type="checkbox" readOnly></input>;
      }
      break;
    default:
      result = cellValue.toString();
  }
  return result;
}

const ItemPropTypes = {
  tableData: PropTypes.object.isRequired,
  row: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  includedColumns: PropTypes.array,
};

function Item(props) {
  const { tableData, index, row, includedColumns } = props;
  const { related_user_list, columns } = tableData;
  return (
    <tr key={index}>
      {columns.map((column, index) => {
        if (column.type === CellType.LINK || !includedColumns.includes(column.name)) return null;
        return <td key={index}>{covertRow(row, column, related_user_list)}</td>;
      })}
    </tr>
  );
}

Item.propTypes = ItemPropTypes;

export default DTableExcelPreviewDialog;
