import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import html5DragDropContext from '../../utils/html5DragDropContext';
import Loading from '../../components/loading';
import EndRemark from '../../components/end-remarks';
import { dtableWebAPI } from '../../api/dtable-web-api';
import { convertRowDataBack, Utils } from '../../utils/utils';
import RowItem from './row-item';
import RemarkItem from '../../components-form/remark-item';
import { getInvalidEmailColumns, getInvalidTextRegColumns, getInvalidCheckboxColumns, getInvalidNumberColumns } from '../../components-form/utils/utils';
import FormLogo from './form-logo';
import { isPro } from '../../utils/constants';
import { FORM_ELEMENTS_TYPE } from '../../constants/form-constants';
import FormThemeBackground from '../../components-form/form-theme-background';
import FormPoweredMobile from '../../components-form/mobile/form-powered-mobile';
import FormContentStaticRemark from '../dtable-edit-form/widgets/form-content-static-remark';
import FormContentStaticSplitLine from '../dtable-edit-form/widgets/form-content-static-split-line';

import './css/end-remark.css';
import './css/dtable-shared-form-mobile.css';

const gettext = window.gettext;
const { dtableName: fileName, workspaceID, dtableUuid, token, customPoweredBy } = window.shared.pageOptions;

const EDITOR_CONFIG = {
  workspaceID,
  fileName,
  dtableUuid,
  token,
  editorIn: 'form',
};

const propTypes = {
  formConfig: PropTypes.object.isRequired,
  rowData: PropTypes.object,
  prefillForceNames: PropTypes.array,
  prefillHidenNames: PropTypes.array,
  saveCommitText: PropTypes.func.isRequired,
  getHistoryCommitByColumnKey: PropTypes.func.isRequired,
  getFormatRowData: PropTypes.func.isRequired,
  getFilteredColumns: PropTypes.func.isRequired,
  initFormConfig: PropTypes.func.isRequired,
  getMissedRequiredCells: PropTypes.func.isRequired,
};

class AppMainMobile extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isDataLoading: true,
      table_id: '',
      columns: [],
      formName: '',
      remarkContent: '',
      topRemarkContent: '',
      successMessage: '',
      successRedirect: '',
      isShowEndRemark: false,
      showEditorIdx: -1,
      isSubmitting: false,
      isHidePoweredBy: false,
      elementsOrder: [],
      staticElements: [],
      formColumnDescriptionColor: '',
    };
    this.rowData = props.rowData || {};
    this.formContentRef = null;
  }

  componentDidMount() {
    let formConfig = this.props.initFormConfig(this.rowData);
    this.setState({
      isDataLoading: false,
      ...formConfig
    });
  }

  componentWillUnmount() {
    this.formContentRef = null;
  }

  onCommit = (updated) => {
    this.rowData = Object.assign({}, this.rowData, updated);
    let filterColumns = this.props.getFilteredColumns(this.props.formConfig.columns, this.rowData);
    this.setState({ columns: filterColumns });
  };

  onSubmit = () => {
    this.setState({ isSubmitting: true, showEditorIdx: -1 }, () => {
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
          let showEditorIdx = elementsOrder.findIndex(column => column.key === missedRequiredCells[0].key);
          this.isEditorOpenedByTab = true;
          this.setState({ showEditorIdx, isSubmitting: false });
          return;
        }

        let invalidEmailColumns = getInvalidEmailColumns(columns, convertedRowData);
        if (invalidEmailColumns.length > 0) {
          let showEditorIdx = elementsOrder.findIndex(column => column.key === invalidEmailColumns[0].key);
          this.isEditorOpenedByTab = true;
          this.setState({ showEditorIdx, isSubmitting: false });
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
            isSubmitting: false,
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

  setScrollTop = (offsetTop) => {
    let { offsetHeight, scrollTop } = this.formContentRef;
    let realOffsetTop = offsetTop - 50; // 50: title height
    if (scrollTop < realOffsetTop && realOffsetTop < scrollTop + offsetHeight - 100) return; // 100: footer height
    let top = offsetTop - offsetHeight * 0.5;
    this.formContentRef.scrollTop = top < 0 ? 0 : top;
  };

  updateTabIndex = (showEditorIdx) => {
    this.setState({ showEditorIdx });
  };

  getRowItems = () => {
    const { showEditorIdx, isSubmitting, staticElements, elementsOrder, columns, formColumnDescriptionColor } = this.state;
    const { formConfig, prefillForceNames, prefillHidenNames } = this.props;
    let unHiddenColumns = columns.slice(0);
    if (prefillHidenNames && prefillHidenNames.length > 0){
      unHiddenColumns = columns.filter(column => !prefillHidenNames.includes(column.name));
    }
    const { columns: allColumns } = formConfig;
    if (elementsOrder.length === 0) {
      return (
        <div className="form-content-no-fields d-flex align-items-center justify-content-center">
          <span>{gettext('Please add fields in the form settings')}</span>
        </div>
      );
    }
    return elementsOrder.map((item, index) => {
      if (item.type === FORM_ELEMENTS_TYPE.COLUMN) {
        const column = unHiddenColumns.find(column => column.key === item.key);
        if (!column) return null;
        const { key, name, enable_fill_default_value, enable_not_change_default_value } = column;
        const isReadOnly = (enable_fill_default_value && enable_not_change_default_value) || prefillForceNames.includes(name);
        return (
          <RowItem
            key={key}
            column={column}
            editorConfig={EDITOR_CONFIG}
            formColumnDescriptionColor={formColumnDescriptionColor}
            isEditorShow={index === showEditorIdx}
            value={this.rowData[key]}
            isReadOnly={isReadOnly}
            isSubmitting={(enable_fill_default_value && enable_not_change_default_value) || isSubmitting}
            row={this.rowData}
            columns={allColumns}
            onCommit={this.onCommit}
            setScrollTop={this.setScrollTop}
            updateTabIndex={(isEditorClose) => this.updateTabIndex(index, isEditorClose)}
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

  onContinueSubmit = () => {
    this.rowData = this.props.rowData || {};
    let formConfig = this.props.initFormConfig(this.rowData);
    this.setState({ isShowEndRemark: false, ...formConfig });
  };

  getShowContent = () => {
    const { isShowEndRemark, isSubmitting, successMessage, successRedirect, isHidePoweredBy, topRemarkContent,
      elementsOrder, remarkContent } = this.state;
    if (isShowEndRemark) {
      return (
        <>
          <EndRemark
            successMessage={successMessage}
            successRedirect={successRedirect}
            onContinueSubmit={this.onContinueSubmit}
          />
          <FormPoweredMobile
            isPro={isPro}
            isHidePoweredBy={isHidePoweredBy}
            customPoweredBy={customPoweredBy}
            className="end-remark-form-footer"
          />
        </>
      );
    }

    return (
      <div className="form-content" ref={ref => this.formContentRef = ref}>
        <div className="form-items-container">
          {topRemarkContent && <RemarkItem key="form-note-top" className="form-note-top" remarkContent={topRemarkContent}/>}
          <div className="form-table-line" key="form-table-line"></div>
          {this.getRowItems()}
          {remarkContent && <RemarkItem key="form-note-bottom" className="form-note-bottom" remarkContent={remarkContent}/>}
          <div className="form-footer">
            {elementsOrder.length > 0 &&
              <button className="btn btn-primary w-100 d-flex submit-form mt-2" onMouseDown={this.onSubmit} disabled={isSubmitting}>
                {isSubmitting && <Loading />}
                {gettext('Submit')}
              </button>
            }
            <FormPoweredMobile isPro={isPro} isHidePoweredBy={isHidePoweredBy} customPoweredBy={customPoweredBy} />
          </div>
        </div>
      </div>
    );
  };

  render() {
    const { isDataLoading, formName, themeType, themeBackgroundColor, themeBackgroundImageURL,
      isShowEndRemark } = this.state;
    if (isDataLoading) {
      return <Loading />;
    }
    const logo_url = this.props.formConfig.logo_url;
    return (
      <Fragment>
        {!isShowEndRemark && (
          <>
            <FormThemeBackground
              themeType={themeType}
              themeBackgroundColor={themeBackgroundColor}
              themeBackgroundImageURL={themeBackgroundImageURL}
            />
            <div className="form-header">
              <FormLogo name={formName} url={logo_url} isMobile={true}/>
            </div>
          </>
        )}
        {this.getShowContent()}
      </Fragment>
    );
  }
}

AppMainMobile.propTypes = propTypes;

export default html5DragDropContext(AppMainMobile);
