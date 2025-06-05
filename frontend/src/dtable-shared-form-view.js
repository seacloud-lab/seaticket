import React, { Suspense, Fragment } from 'react';
import { createRoot } from 'react-dom/client';
import MediaQuery from 'react-responsive';
import { I18nextProvider } from 'react-i18next';
import {
  filterRows, CellType, formatStringToNumber, getNumberDisplayString,
  getDurationDisplayString, convertRowBack, FILL_DEFAULT_VALUE_COLUMNS_TYPE,
  getGeolocationDisplayString, isNumericColumn,
} from 'dtable-utils';
import i18n from './i18n-dtable';
import dayjs from './components/common/dayjs';
import AppMain from './pages/dtable-share-form/app-main';
import AppMainMobile from './pages/dtable-share-form/app-main-mobile';
import Loading from './components/loading';
import {
  SEATABLE_FORM,
  SAVE_COMMIT_HISTORY_TYPES,
  FORM_THEME_TYPE,
  FORM_THEME_COLORS,
  FORM_ELEMENTS_TYPE,
} from './constants/form-constants';
import { isIPhone, isQQBuiltInBrowser, convertRowDataBack } from './utils/utils';
import { getThemeBackgroundColorByFormConfig, getValidElementsOrder } from './utils/form-utils';
import { mediaUrl } from './utils/constants';

import './css/dtable-share-form.css';

const gettext = window.gettext;
const { dtableMetadata, formConfig, token, user } = window.shared.pageOptions;

class DTableFormView extends React.Component {

  constructor(props) {
    super(props);
    const formConfigData = JSON.parse(formConfig);
    document.title = formConfigData.form_name;
    this.state = {
      isLoading: true,
      formConfigData,
    };
    this.rowData = {};
    this.prefillForceNames = [];
    this.prefillHidenNames = [];
    this.isIPhone = isIPhone();
    this.isQQBuiltInBrowser = isQQBuiltInBrowser();
  }

  componentDidMount() {
    if (this.isIPhone && this.isQQBuiltInBrowser) {
      this.setState({ isLoading: false });
    }
    let { formConfigData } = this.state;
    let tables = JSON.parse(dtableMetadata).metadata.tables;
    try {
      let currentTable = tables.find(table => { return table._id === formConfigData.table_id; });
      let serverColumns = currentTable.columns;
      let dbColumns = formConfigData.columns;
      let columns = [];
      serverColumns.forEach(serverColumn => {
        let dbColumn = dbColumns.find(item => item.key === serverColumn.key);
        // Column description needs to use the form dbColumn description
        // Column other attributes need to use the latest serverColumn（column's name or type changed）
        if (dbColumn) {
          const { description, ...serverColumnNoDescription } = serverColumn;
          columns.push(Object.assign({}, dbColumn, serverColumnNoDescription));
        }
      });
      formConfigData.columns = this.getNormalizedColumns(columns);
      this.rowData = this.initRowData(columns);
      this.setState({
        isLoading: false,
        formConfigData: formConfigData
      });
    } catch (err) {
      let errorMessage = gettext('The form you want to access has not been created.');
      this.setState({
        isLoading: false,
        errorMessage: errorMessage
      });
    }
  }

  getNormalizedColumns = (columns) => {
    return columns.map(column => {
      let { filters, show_on_condition } = column;
      let newFilters = [];
      if (show_on_condition) {
        filters.forEach(filter => {
          let filterColumn = columns.find(item => item.key === filter.column_key);
          if (filterColumn) {
            newFilters.push(Object.assign({}, filter, { column: { type: filterColumn.type, data: filterColumn.data } }));
          }
        });
        if (newFilters.length === 0) {
          return Object.assign({}, column, { filters: [], show_on_condition: false });
        }
        return Object.assign({}, column, { filters: newFilters });
      }
      return column;
    });
  };

  setScrollTop = (offsetTop) => {
    let { offsetHeight, scrollTop } = this.seaTableShareForm;
    if (scrollTop + offsetHeight < offsetTop || scrollTop > offsetTop) {
      this.seaTableShareForm.scrollTop = offsetTop - offsetHeight * 0.3;
    }
  };

  saveCommitText = (columns, commitData = {}) => {
    const textColumns = columns.filter(column => SAVE_COMMIT_HISTORY_TYPES.includes(column.type));
    if (textColumns.length === 0) return;
    const { formConfigData = {} } = this.state;
    const { table_id } = formConfigData;
    let historyLocalStorage = JSON.parse(window.localStorage.getItem(SEATABLE_FORM)) || {};
    let historyCommitForm = historyLocalStorage[token] || {};
    let historyCommitTable = historyCommitForm[table_id] || {};
    let updatedCommitTable = {};
    textColumns.forEach(column => {
      let { key } = column;
      let currentValue = commitData[key];
      let historyValueList = historyCommitTable[key] || [];
      if (currentValue && !historyValueList.includes(currentValue)) {
        if (historyValueList.length >= 10) {
          historyValueList = historyValueList.slice(1);
        }
        historyValueList.push(currentValue);
        updatedCommitTable[key] = historyValueList;
      }
    });
    let updateHistoryCommitTable = Object.assign({}, historyCommitTable, updatedCommitTable);
    let updateHistoryCommitForm = Object.assign({}, historyCommitForm, { [table_id]: updateHistoryCommitTable });
    window.localStorage.setItem(SEATABLE_FORM, JSON.stringify(Object.assign({}, historyLocalStorage, { [token]: updateHistoryCommitForm })));
  };

  getHistoryCommitByColumnKey = (columnKey) => {
    const { formConfigData = {} } = this.state;
    const { table_id } = formConfigData;
    const historyLocalStorage = JSON.parse(window.localStorage.getItem(SEATABLE_FORM)) || {};
    const historyCommitForm = historyLocalStorage[token] || {};
    const historyCommitTable = historyCommitForm[table_id] || {};
    return historyCommitTable[columnKey] || [];
  };

  getFormatRowData = (columns, rowData = {}) => {
    let formatRowData = {};
    Object.keys(rowData).forEach(key => {
      let targetCol = columns.find(column => column.key === key);
      if (targetCol) {
        let { name: colName, type, data } = targetCol;
        let colValue = rowData[key];
        let updated = { [colName]: colValue };
        if (type === CellType.SINGLE_SELECT) {
          let options = data && data.options ? data.options : [];
          let option = options.find(item => item.id === colValue);
          updated[colName] = option ? option.name : '';
        } else if (type === CellType.MULTIPLE_SELECT) {
          if (!Array.isArray(colValue)) {
            colValue = [];
          }
          let options = data && data.options ? data.options : [];
          updated[colName] = colValue.map(valueItem => {
            let option = options.find(item => item.id === valueItem);
            return option ? option.name : '';
          });
        } else if (type === CellType.TEXT) {
          updated[colName] = colValue ? colValue.trim() : '';
        } else if (type === CellType.DATE && colValue === 'current_date') {
          let format = data && data.format;
          let defaultDateFormat = 'YYYY-MM-DD';
          // Old Europe format is D/M/YYYY new format is DD/MM/YYYY
          format = format.replace(/D\/M\/YYYY/, 'DD/MM/YYYY');
          const dateFormat = format || defaultDateFormat;
          const newValue = dayjs(new Date()).format(dateFormat);
          updated[colName] = newValue;
        } else if (type === CellType.NUMBER) {
          updated[colName] = colValue ? formatStringToNumber(colValue, data) : '';
        }
        formatRowData = Object.assign({}, formatRowData, updated);
      }
    });

    let newRowData = {};
    let newLinkData = {};

    for (let key in formatRowData) {
      let cellValue = formatRowData[key];
      if (!cellValue || !cellValue.column) {
        newRowData[key] = cellValue;
      } else {
        // link data in formateRowData
        newLinkData[key] = cellValue;
      }
    }
    return { newRowData, newLinkData };
  };

  getFilteredColumns = (columns, rowData = {}) => {
    const row = convertRowDataBack(columns, rowData);
    return columns.filter(column => {
      let { filters, filter_conjunction: filterConjunction, show_on_condition: showOnCondition } = column;
      if (showOnCondition) {
        const filteredRows = filterRows(filterConjunction, filters, [row], {});
        return filteredRows.length > 0;
      }
      return true;
    });
  };

  initRowData = (columns) => {
    const currentUser = JSON.parse(user);
    let rowData = {};
    let defaultRowData = {};
    let defaultReadOnlyRowData = {};

    // get default value
    const defaultValueColumns = columns.filter(column => FILL_DEFAULT_VALUE_COLUMNS_TYPE.includes(column.type) && column.enable_fill_default_value);
    defaultValueColumns.forEach(column => {
      const { enable_fill_default_value: enableFillDefaultValue, default_value: defaultValue,
        enable_not_change_default_value: enableNotChangeDefaultValue, key, type } = column;
      let validDefaultValue;
      if (isNumericColumn(column)) {
        validDefaultValue = (defaultValue || defaultValue === 0) ? defaultValue : '';
      } else {
        validDefaultValue = defaultValue || '';
      }
      if (type === CellType.TEXT) {
        validDefaultValue = validDefaultValue.replace(/\{[^}]+\}/ig, (specialVariable) => {
          if (specialVariable.toLocaleLowerCase() === '{creator.name}') {
            if (currentUser) {
              return currentUser.name;
            }
          } else if (specialVariable.toLocaleLowerCase() === '{creator.id}') {
            if (currentUser) {
              return currentUser.id;
            }
          }
          return '';
        });
      }
      if (enableFillDefaultValue) {
        defaultRowData[key] = validDefaultValue;
      }
      if (enableFillDefaultValue && enableNotChangeDefaultValue) {
        defaultReadOnlyRowData[key] = validDefaultValue;
      }
    });

    // get pre fill rowData
    const preFillString = location.search || location.hash;
    if (preFillString) {
      const paramValueIndex = preFillString.indexOf('?');
      const validPreFillString = preFillString.slice(paramValueIndex + 1);
      let validPreFills = {};
      const searchParams = new URLSearchParams(validPreFillString);
      for (let query of searchParams) {
        const key = query[0];
        const value = query[1];
        let preFillName;
        if (key && key.slice(0, 8) === 'prefill_') {
          preFillName = decodeURIComponent(key.slice(8));
        } else if (key && key.slice(0, 13) === 'prefillForce_') {
          preFillName = decodeURIComponent(key.slice(13));
          this.prefillForceNames.push(preFillName);
        } else if (key && key.slice(0, 12) === 'prefillHide_') {
          preFillName = decodeURIComponent(key.slice(12));
          this.prefillHidenNames.push(preFillName);
        } else {
          preFillName = '';
        }
        let preFillValue = value ? value.trim() : '';
        const column = columns.find(column => column.name === preFillName);
        if (column && column.type === CellType.MULTIPLE_SELECT) {
          preFillValue = value ? value.split(',') : [];
        }
        if (preFillName && preFillValue) {
          validPreFills[preFillName] = preFillValue;
        }
      }
      rowData = convertRowBack(validPreFills, { columns });
    }

    rowData = { ...defaultRowData, ...rowData, ...defaultReadOnlyRowData };
    Object.keys(rowData).forEach(key => {
      const value = rowData[key];
      const column = columns.find(column => column.key === key);
      const { type, data } = column;
      if (type === CellType.NUMBER) {
        rowData[key] = (value || value === 0) ? getNumberDisplayString(value, data) : '';
      } else if (type === CellType.DURATION) {
        rowData[key] = getDurationDisplayString(value, data);
      }
    });
    return rowData;
  };

  initFormConfig = (rowData) => {
    let { formConfigData } = this.state;
    let { table_id, columns, form_name, remarkOption = {}, top_remark_option = {},
      success_message_option = {}, powered_by_option = {}, success_redirect_option = {},
      theme_type, theme_background_color, theme_background_image_url, logo_url, elements_order = [],
      static_elements = [], form_column_description_color,
    } = formConfigData;
    let currentColumns = this.getFilteredColumns(columns, rowData);
    const editableColumns = columns.filter(column => column.editable);
    let elementsOrder = getValidElementsOrder(columns, elements_order);
    // Compatible with previous version
    if (editableColumns.length > 0 && elementsOrder.length === 0) {
      editableColumns.forEach(column => {
        const columnElement = { type: FORM_ELEMENTS_TYPE.COLUMN, key: column.key };
        elementsOrder.push(columnElement);
      });
    }
    currentColumns = currentColumns.sort((a, b) => {
      return elementsOrder.findIndex(item => item.key === a.key) > elementsOrder.findIndex(item => item.key === b.key) ? 1 : -1;
    });
    return {
      table_id: table_id,
      columns: currentColumns,
      elementsOrder,
      staticElements: static_elements,
      formColumnDescriptionColor: form_column_description_color || '',
      formName: form_name,
      remarkContent: remarkOption.isRemarkContentShow ? remarkOption.remarkContent : '',
      topRemarkContent: top_remark_option.is_top_remark_content_show ? top_remark_option.top_remark_content : '',
      successMessage: success_message_option.is_success_message_show ? success_message_option.success_message : '',
      successRedirect: success_redirect_option.is_success_redirect_show ? success_redirect_option.success_redirect : '',
      isHidePoweredBy: powered_by_option.isHidePoweredBy,
      themeType: theme_type || FORM_THEME_TYPE.COLOR,
      themeBackgroundColor: theme_background_color || FORM_THEME_COLORS[0],
      themeBackgroundImageURL: theme_background_image_url || '',
      logoURL: logo_url || ''
    };
  };

  getMissedRequiredCells = (columns = [], rowData = {}) => {
    return columns.filter(column => {
      const { key, type, is_required, data } = column;
      let cellValue = rowData[key];
      if (!is_required) return false;

      switch (type) {
        case CellType.FILE:
        case CellType.IMAGE:
        case CellType.MULTIPLE_SELECT: {
          return !(Array.isArray(cellValue) && cellValue.length > 0);
        }
        case CellType.LINK: {
          if (!cellValue) return true;
          if (!cellValue.column) return true;
          const realValue = cellValue.other_rows_ids;
          return !(Array.isArray(realValue) && realValue.length > 0);
        }
        case CellType.CHECKBOX: {
          return false;
        }
        case CellType.LONG_TEXT: {
          return (typeof cellValue === 'object' && cellValue.text) ? false : true;
        }
        case CellType.GEOLOCATION: {
          if (!cellValue) return true;
          return !getGeolocationDisplayString(cellValue, data);
        }
        default: {
          return !cellValue;
        }
      }
    });
  };

  render() {
    let { isLoading, formConfigData, errorMessage } = this.state;
    if (isLoading) {
      return <Loading />;
    }
    if (this.isIPhone && this.isQQBuiltInBrowser) {
      const tipMessage = '不支持 iOS 版 QQ 内置浏览器提交表单数据。';
      return (
        <div className="open-external-browser">
          <div className="error-tip">{tipMessage}</div>
          <div className="image-container">
            <img src={mediaUrl + 'img/qq-form-tip.png'} alt='Open browser tip'/>
          </div>
        </div>
      );
    }
    if (errorMessage) {
      return <p className="text-center mt-8 error">{errorMessage}</p>;
    }
    const mainBackground = getThemeBackgroundColorByFormConfig(formConfigData);
    const formStyle = { backgroundColor: mainBackground };
    return (
      <Fragment>
        <MediaQuery query="(max-width: 767.8px)">
          <div id="seatable-share-form" className='seatable-share-form app-main-mobile'>
            <AppMainMobile
              rowData={this.rowData}
              prefillForceNames={this.prefillForceNames}
              prefillHidenNames={this.prefillHidenNames}
              formConfig={formConfigData}
              saveCommitText={this.saveCommitText}
              getHistoryCommitByColumnKey={this.getHistoryCommitByColumnKey}
              getFormatRowData={this.getFormatRowData}
              getFilteredColumns={this.getFilteredColumns}
              initFormConfig={this.initFormConfig}
              getMissedRequiredCells={this.getMissedRequiredCells}
            />
          </div>
        </MediaQuery>
        <MediaQuery query="(min-width: 767.8px)">
          <div
            id="seatable-share-form"
            className="seatable-share-form"
            ref={ref => this.seaTableShareForm = ref}
            style={formStyle}
          >
            <AppMain
              formConfig={formConfigData}
              rowData={this.rowData}
              prefillForceNames={this.prefillForceNames}
              prefillHidenNames={this.prefillHidenNames}
              setScrollTop={this.setScrollTop}
              saveCommitText={this.saveCommitText}
              getHistoryCommitByColumnKey={this.getHistoryCommitByColumnKey}
              getFormatRowData={this.getFormatRowData}
              getFilteredColumns={this.getFilteredColumns}
              initFormConfig={this.initFormConfig}
              getMissedRequiredCells={this.getMissedRequiredCells}
            />
          </div>
        </MediaQuery>
      </Fragment>
    );
  }
}

const root = createRoot(document.getElementById('wrapper'));
root.render(
  <I18nextProvider i18n={i18n}>
    <Suspense fallback={<Loading/>}>
      <DTableFormView />
    </Suspense>
  </I18nextProvider>
);
