import React, { Suspense, Fragment } from 'react';
import { createRoot } from 'react-dom/client';
import MediaQuery from 'react-responsive';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n-dtable';
import Loading from './components/loading';
import { dtableWebAPI } from './api/dtable-web-api';
import AppMain from './pages/dtable-edit-form/app-main';
import AppMainMobile from './pages/dtable-edit-form/app-main-mobile';
import { getFormConfigColumns, getFormSupportColumns, getUpdatedFormConfig, getValidElementsOrder } from './utils/form-utils';
import { FORM_THEME_TYPE, FORM_THEME_COLORS, FORM_ELEMENTS_TYPE } from './constants/form-constants';

import './css/dtable-share-form.css';
import './css/dtable-edit-form.css';

const { dtableMetadata, formConfig } = window.shared.pageOptions;
window.dtableWebAPI = dtableWebAPI;

class DtableEditFormView extends React.Component {

  constructor(props) {
    super(props);
    this.formConfig = JSON.parse(formConfig);
    const metadata = JSON.parse(dtableMetadata).metadata;
    this.tables = metadata.tables;
  }

  getInitFormConfig = () => {
    const { remarkOption = {}, form_name, top_remark_option = {}, success_message_option = {},
      success_redirect_option = {}, submit_deadline_option = {}, powered_by_option = {}, logo_url,
      theme_type, theme_background_image_url, theme_background_color, trigger_workflow_option = {},
      elements_order = [], static_elements = [], share_form_links = [], is_set_all_fields_required,
      form_column_description_color
    } = this.formConfig;
    let tableId = this.formConfig.table_id;
    let columns = []; let oldColumnsMap = {}; let notification = {};
    let table = this.tables.find(table => table._id === tableId);
    let isValidFormConfig = true;
    if (table) {
      columns = getFormSupportColumns(table.columns);
      notification = this.formConfig.notification_config;
      this.formConfig.columns.forEach(column => {
        const { key } = column;
        oldColumnsMap[key] = Object.assign({}, column, { editable: true });
      });
    } else {
      isValidFormConfig = false;
      table = this.tables[0];
      columns = getFormSupportColumns(table.columns);
      notification = { is_send_notification: false, notification_selected_users: [] };
      columns.forEach(column => {
        const { key } = column;
        oldColumnsMap[key] = { editable: false };
      });
    }
    const currentColumns = getFormConfigColumns(columns, oldColumnsMap);
    const editableColumns = currentColumns.filter(column => column.editable);
    let elementsOrder = getValidElementsOrder(currentColumns, elements_order);
    // Compatible with previous version
    if (editableColumns.length > 0 && elementsOrder.length === 0) {
      editableColumns.forEach(column => {
        const columnElement = { type: FORM_ELEMENTS_TYPE.COLUMN, key: column.key };
        elementsOrder.push(columnElement);
      });
    }
    return {
      isValidFormConfig,
      formConfig: {
        currentColumns,
        elementsOrder,
        staticElements: static_elements,
        tableId: table._id,
        notification,
        formName: form_name,
        shareFormLinks: share_form_links,
        remarkContent: remarkOption.remarkContent || '',
        isRemarkContentShow: remarkOption.isRemarkContentShow || false,
        topRemarkContent: top_remark_option.top_remark_content || '',
        isTopRemarkContentShow: top_remark_option.is_top_remark_content_show || false,
        successMessage: success_message_option.success_message || '',
        isSuccessMessageShow: success_message_option.is_success_message_show || false,
        successRedirect: success_redirect_option.success_redirect || '',
        isSuccessRedirectShow: success_redirect_option.is_success_redirect_show || false,
        submitDeadline: submit_deadline_option.submit_deadline || '',
        isSubmitDeadlineShow: submit_deadline_option.is_submit_deadline_show || false,
        isHidePoweredBy: powered_by_option.isHidePoweredBy || false,
        themeType: theme_type || FORM_THEME_TYPE.COLOR,
        themeBackgroundColor: theme_background_color || FORM_THEME_COLORS[0],
        themeBackgroundImageURL: theme_background_image_url || '',
        logoURL: logo_url || '',
        workflowName: trigger_workflow_option.workflow_name || '',
        isTriggerWorkflow: trigger_workflow_option.is_trigger_workflow || false,
        canTriggerWorkflow: trigger_workflow_option.can_trigger_workflow || false,
        workflowToken: trigger_workflow_option.workflow_token || '',
        isSetAllFieldsRequired: is_set_all_fields_required || false,
        formColumnDescriptionColor: form_column_description_color || '',
      }
    };
  };

  getUpdatedFormConfig = (updated) => {
    return getUpdatedFormConfig(this.formConfig, updated);
  };

  render() {
    const appMainProps = {
      tables: this.tables,
      getInitFormConfig: this.getInitFormConfig,
      getUpdatedFormConfig: this.getUpdatedFormConfig
    };

    return (
      <Fragment>
        <MediaQuery query="(min-width: 767.8px)">
          <AppMain { ...appMainProps } />
        </MediaQuery>
        <MediaQuery query="(max-width: 767.8px)">
          <AppMainMobile { ...appMainProps } />
        </MediaQuery>
      </Fragment>
    );
  }
}

const root = createRoot(document.getElementById('wrapper'));
root.render(
  <I18nextProvider i18n={i18n}>
    <Suspense fallback={<Loading/>}>
      <DtableEditFormView />
    </Suspense>
  </I18nextProvider>
);
