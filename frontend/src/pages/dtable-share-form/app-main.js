import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import isHotkey from 'is-hotkey';
import { toaster } from 'dtable-ui-component';
import html5DragDropContext from '../../utils/html5DragDropContext';
import Loading from '../../components/loading';
import EndRemark from '../../components/end-remarks';
import { dtableWebAPI } from '../../api/dtable-web-api';
import { convertRowDataBack, isGeolocationCellEditable, Utils } from '../../utils/utils';
import RowItem from './row-item';
import FormContentStaticRemark from '../dtable-edit-form/widgets/form-content-static-remark';
import FormContentStaticSplitLine from '../dtable-edit-form/widgets/form-content-static-split-line';
import FormBlankContent from '../dtable-edit-form/widgets/form-blank-content';
import RemarkItem from '../../components-form/remark-item';
import { getInvalidEmailColumns, getInvalidTextRegColumns, getInvalidCheckboxColumns, getInvalidNumberColumns } from '../../components-form/utils/utils';
import FormLogo from './form-logo';
import { isPro } from '../../utils/constants';
import FormThemeBackground from '../../components-form/form-theme-background';
import FormFooter from '../../components-form/form-footer';
import { FORM_ELEMENTS_TYPE } from '../../constants/form-constants';
import { CellType } from 'dtable-utils';

import './css/end-remark.css';

const gettext = window.gettext;
const { dtableName: fileName, workspaceID, dtableUuid, token, customPoweredBy } = window.shared.pageOptions;

const EDITOR_CONFIG = {
  workspaceID,
  fileName,
  dtableUuid,
  token,
  editorIn: 'form'
};

const propTypes = {
  formConfig: PropTypes.object.isRequired,
  rowData: PropTypes.object,
  prefillForceNames: PropTypes.array,
  prefillHidenNames: PropTypes.array,
  setScrollTop: PropTypes.func.isRequired,
  saveCommitText: PropTypes.func.isRequired,
  getHistoryCommitByColumnKey: PropTypes.func.isRequired,
  getFormatRowData: PropTypes.func.isRequired,
  getFilteredColumns: PropTypes.func.isRequired,
  initFormConfig: PropTypes.func.isRequired,
  getMissedRequiredCells: PropTypes.func.isRequired,
};

class AppMain extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isDataLoading: true,
      isSubmitting: false,
      isShowEndRemark: false,
      isHidePoweredBy: false,
      tabIndex: -1,
      table_id: '',
      columns: [],
      formName: '',
      remarkContent: '',
      topRemarkContent: '',
      successMessage: '',
      successRedirect: '',
      themeType: '',
      themeBackgroundColor: '',
      themeBackgroundImageURL: '',
      logoURL: '',
      elementsOrder: [],
      staticElements: [],
      formColumnDescriptionColor: '',
      isCapsLockDown: false
    };
    this.rowData = props.rowData || {};
    // jump to editor while editor opened by tab or submit not include required fields
    this.isEditorOpenedByTab = false;
  }

  componentDidMount() {
    let formConfig = this.props.initFormConfig(this.rowData);
    this.setState({
      isDataLoading: false,
      ...formConfig
    });
    const { elementsOrder } = formConfig;
    this.columnElements = elementsOrder.filter(element => element.type === FORM_ELEMENTS_TYPE.COLUMN);
    document.addEventListener('keyPress', this.handleKeyDown);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  handleKeyDown = (event) => {this.onKeyDown(event);};

  onCommit = (updated) => {
    this.rowData = Object.assign({}, this.rowData, updated);
    let { formConfig } = this.props;
    let { elementsOrder } = this.state;
    let filterColumns = this.props.getFilteredColumns(formConfig.columns, this.rowData);
    filterColumns = filterColumns.sort((a, b) => {
      return elementsOrder.findIndex(item => item.key === a.key) > elementsOrder.findIndex(item => item.key === b.key) ? 1 : -1;
    });
    this.setState({ columns: filterColumns });
  };

  onSubmit = () => {
    this.setState({ isSubmitting: true, tabIndex: -1 }, () => {
      const convertedRowData = convertRowDataBack(this.state.columns, this.rowData);
      setTimeout(() => {
        let { columns, elementsOrder } = this.state;
        let missedRequiredCells = this.props.getMissedRequiredCells(columns, this.rowData);
        let missedRequiredCellsLen = missedRequiredCells.length;
        if (missedRequiredCellsLen > 0) {
          let message = missedRequiredCellsLen > 1 ?
            gettext('Some required fields are missing')
            :
            gettext('A required field is missing');
          toaster.danger(message);
          let tabIndex = elementsOrder.findIndex(column => column.key === missedRequiredCells[0].key);
          this.isEditorOpenedByTab = true;
          this.setState({ tabIndex, isSubmitting: false });
          return;
        }

        let invalidEmailColumns = getInvalidEmailColumns(columns, convertedRowData);
        if (invalidEmailColumns.length > 0) {
          let tabIndex = elementsOrder.findIndex(column => column.key === invalidEmailColumns[0].key);
          this.isEditorOpenedByTab = true;
          this.setState({ isSubmitting: false, tabIndex });
          return;
        }

        let invalidTextRegColumns = getInvalidTextRegColumns(columns, convertedRowData);
        if (invalidTextRegColumns.length > 0) {
          let tabIndex = elementsOrder.findIndex(column => column.key === invalidTextRegColumns[0].key);
          this.isEditorOpenedByTab = true;
          this.setState({ isSubmitting: false, tabIndex });
          return;
        }

        let invalidNumberRegColumns = getInvalidNumberColumns(columns, convertedRowData);
        if (invalidNumberRegColumns.length > 0) {
          let tabIndex = elementsOrder.findIndex(column => column.key === invalidNumberRegColumns[0].key);
          this.isEditorOpenedByTab = true;
          this.setState({ isSubmitting: false, tabIndex });
          return;
        }

        const invalidCheckboxColumns = getInvalidCheckboxColumns(columns, convertedRowData);
        if (invalidCheckboxColumns.length > 0) {
          let tabIndex = elementsOrder.findIndex(column => column.key === invalidCheckboxColumns[0].key);
          this.isEditorOpenedByTab = true;
          let message = invalidCheckboxColumns.length > 1 ?
            gettext('Some checkboxes must be checked')
            :
            gettext('A checkbox must be checked');
          toaster.danger(message);
          this.setState({ isSubmitting: false, tabIndex });
          return;
        }
        // convert row as {column_name: value, ...}
        const { table_id } = this.state;
        let { newRowData, newLinkData } = this.props.getFormatRowData(columns, this.rowData);
        let rowData = JSON.stringify(newRowData);
        let linkData = Object.keys(newLinkData).length > 0 ? JSON.stringify(newLinkData) : null;
        dtableWebAPI.submitFormData(token, table_id, rowData, linkData).then(res => {
          const { success_message } = res.data;
          const stateUpdate = {
            isShowEndRemark: true,
            isSubmitting: false
          };
          if (success_message) {
            stateUpdate.successMessage = success_message;
          }
          this.setState(stateUpdate, () => {
            this.props.saveCommitText(columns, this.rowData);
          });
        }).catch(error => {
          let errorMessage = Utils.getErrorMsg(error);
          toaster.danger(errorMessage);
          this.setState({ isSubmitting: false });
        });
      }, 200);
    });
  };

  getRowItems = () => {
    const { tabIndex, isSubmitting, staticElements, elementsOrder, columns, formColumnDescriptionColor } = this.state;
    const { formConfig, prefillForceNames, prefillHidenNames } = this.props;
    let unHiddenColumns = columns.slice(0);
    if (prefillHidenNames && prefillHidenNames.length > 0){
      unHiddenColumns = columns.filter(column => !prefillHidenNames.includes(column.name));
    }
    const { columns: allColumns } = formConfig;
    if (elementsOrder.length === 0) {
      return (
        <div className="form-blank-content">
          <FormBlankContent/>
        </div>
      );
    }
    return elementsOrder.map((item, index) => {
      if (item.type === FORM_ELEMENTS_TYPE.COLUMN) {
        const columnIndex = unHiddenColumns.findIndex(column => column.key === item.key);
        if (columnIndex === -1) return null;
        const column = unHiddenColumns[columnIndex];
        let isCellEditable = true;
        const { key, type, name, enable_fill_default_value, enable_not_change_default_value } = column;
        if (type === CellType.GEOLOCATION) {
          isCellEditable = isGeolocationCellEditable(column);
        }
        const isReadOnly = (enable_fill_default_value && enable_not_change_default_value) || prefillForceNames.includes(name) || !isCellEditable;
        return (
          <RowItem
            key={key}
            column={column}
            editorConfig={EDITOR_CONFIG}
            isEditorShow={columnIndex === tabIndex}
            formColumnDescriptionColor={formColumnDescriptionColor}
            value={this.rowData[key]}
            isReadOnly={isReadOnly}
            isSubmitting={(enable_fill_default_value && enable_not_change_default_value) || isSubmitting}
            row={this.rowData}
            columns={allColumns}
            onCommit={this.onCommit}
            setScrollTop={this.setScrollTop}
            updateTabIndex={() => this.updateTabIndex(columnIndex)}
            getHistoryCommitByColumnKey={this.props.getHistoryCommitByColumnKey}
          />
        );
      } else if (item.type === FORM_ELEMENTS_TYPE.SPLIT_LINE) {
        return (
          <FormContentStaticSplitLine
            key={item.key}
            index={index}
            item={item}
            isEditFormPage={false}
          />
        );
      } else {
        return (
          <FormContentStaticRemark
            key={item.key}
            index={index}
            item={item}
            isEditFormPage={false}
            staticElements={staticElements}
            updateSettingElement={() => {}}
          />
        );
      }
    });
  };

  updateTabIndex = (tabIndex) => {
    this.isEditorOpenedByTab = false;
    this.setState({ tabIndex });
  };

  focusOnElement = (ele) => {
    const formElement = ele.lastElementChild;
    const classList = formElement.classList;
    if (classList.contains('grid-cell-type-long-text')) {
      formElement.firstElementChild.focus();
      return;
    }

    if (classList.contains('form-single-select-container')) {
      formElement.focus();
      return;
    }

    if (classList.contains('grid-cell-type-multiple-select')) {
      formElement.firstElementChild.focus();
      return;
    }

    if (classList.contains('grid-cell-type-date')) {
      formElement.firstElementChild.focus();
      return;
    }

    if (classList.contains('grid-cell-type-checkbox')) {
      formElement.firstElementChild?.firstElementChild?.focus();
      return;
    }

    if (classList.contains('grid-cell-type-file')) {
      formElement.firstElementChild?.firstElementChild?.focus();
      return;
    }

    if (classList.contains('grid-cell-type-image')) {
      formElement.firstElementChild?.firstElementChild?.focus();
      return;
    }

    if (classList.contains('grid-cell-type-geolocation')) {
      formElement.firstElementChild.focus();
      return;
    }

    if (classList.contains('grid-cell-type-text')) {
      formElement.firstElementChild.focus();
      return;
    }

    if (classList.contains('rate-formatter')) {
      formElement.focus();
      return;
    }

    if (classList.contains('digital-sign-editor-wrapper')) {
      formElement.firstElementChild.firstElementChild.focus();
      return;
    }

  };

  onKeyDown = (event) => {
    let { tabIndex, columns, isSubmitting } = this.state;
    if (isSubmitting) return;
    event.stopPropagation();
    if (isHotkey('tab', event)) {
      tabIndex++;
      if (tabIndex >= columns.length + 1) {
        // first one
        event.preventDefault();
        const firstFieldElement = document.querySelector('.form_mode.compose-editor');
        this.focusOnElement(firstFieldElement);
        tabIndex = 0;
      }
      this.isEditorOpenedByTab = true;
      this.setState({ tabIndex });
    } else if (isHotkey('enter', event)) {
      event.preventDefault();
      const { tabIndex, columns, isSubmitting } = this.state;
      if (isSubmitting || tabIndex !== columns.length) return;
      this.onSubmit();
    }
  };

  setScrollTop = (offsetTop) => {
    if (!this.isEditorOpenedByTab) return;
    this.props.setScrollTop(offsetTop);
  };

  onContinueSubmit = () => {
    this.rowData = this.props.rowData || {};
    let formConfig = this.props.initFormConfig(this.rowData);
    this.setState({ isShowEndRemark: false, ...formConfig });
  };

  getShowContent = () => {
    const { isShowEndRemark, isSubmitting, successMessage, successRedirect, formName, themeType, columns,
      themeBackgroundColor, themeBackgroundImageURL, topRemarkContent, remarkContent, elementsOrder, tabIndex } = this.state;
    const canSubmit = !isSubmitting && this.columnElements.length > 0;
    const isEmpty = elementsOrder && elementsOrder.length === 0;
    const isSubmitFocus = tabIndex === columns.length;
    if (isShowEndRemark) {
      return (
        <EndRemark
          successMessage={successMessage}
          successRedirect={successRedirect}
          onContinueSubmit={this.onContinueSubmit}
        />
      );
    }
    return (
      <div className="form-content preview-form-content">
        <FormThemeBackground
          themeType={themeType}
          themeBackgroundColor={themeBackgroundColor}
          themeBackgroundImageURL={themeBackgroundImageURL}
        />
        <FormLogo name={formName} url={this.props.formConfig.logo_url} isMobile={false}/>
        {topRemarkContent && <RemarkItem key="form-note-top" remarkContent={topRemarkContent}/>}
        <div className={`form-table-line ${isEmpty ? '' : 'top-space'}`} key="form-table-line"></div>
        {this.getRowItems()}
        {remarkContent && <RemarkItem key="form-note-bottom" remarkContent={remarkContent}/>}
        {!isEmpty &&
          <button
            className={`btn btn-primary mb-4 mt-4 flex-shrink-0 submit-form d-flex ${isSubmitFocus && 'focus'}`}
            onMouseDown={this.onSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting && <Loading />}
            {gettext('Submit')}
          </button>
        }
      </div>
    );
  };

  render() {
    const { isDataLoading, isShowEndRemark, isHidePoweredBy } = this.state;
    if (isDataLoading) {
      return <Loading />;
    }
    return (
      <Fragment>
        {!isShowEndRemark && <div className="form-header"></div>}
        {this.getShowContent()}
        <FormFooter
          isPro={isPro}
          isHidePoweredBy={isHidePoweredBy}
          customPoweredBy={customPoweredBy}
          className={isShowEndRemark ? 'end-remark-form-footer' : ''}
        />
      </Fragment>
    );
  }
}

AppMain.propTypes = propTypes;

export default html5DragDropContext(AppMain);
