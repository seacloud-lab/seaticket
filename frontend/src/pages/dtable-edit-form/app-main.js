import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { CellType } from 'dtable-utils';
import { toaster } from 'dtable-ui-component';
import Loading from '../../components/loading';
import { Utils } from '../../utils/utils';
import { dtableWebAPI } from '../../api/dtable-web-api';
import ShareFormDialog from './dialog/share-form-dialog';
import AppFormContent from './app-form-content';
import AppFormSettingsPanel from './form-settings-panel';
import { isPro } from '../../utils/constants';
import {
  getFormConfigColumnsByTable,
  getFormSubmitLinkByToken,
  getThemeBackgroundColor
} from '../../utils/form-utils';
import { FORM_CONFIG_STATE, FORM_ELEMENTS_TYPE } from '../../constants/form-constants';
import FormFooter from '../../components-form/form-footer';
import html5DragDropContext from '../../utils/html5DragDropContext';

const gettext = window.gettext;
const { token, dtableWebURL, customPoweredBy, workspaceID } = window.shared.pageOptions;
const { serviceURL } = window.app.config;

class AppMain extends React.Component {

  static contextTypes = {
    dragDropManager: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = {
      isColumnsLoaded: false,
      onRenameToggle: false,
      isSaving: false,
      isSaved: false,
      isShareFormDialogShow: false,
      currentColumns: [],
      elementsOrder: [],
      staticElements: [],
      shareFormLinks: [],
      tableId: '',
      notification: {},
      formName: '',
      remarkContent: '',
      isRemarkContentShow: false,
      topRemarkContent: '',
      isTopRemarkContentShow: false,
      successMessage: '',
      isSuccessMessageShow: false,
      successRedirect: '',
      isSuccessRedirectShow: false,
      submitDeadline: '',
      isSubmitDeadlineShow: false,
      isTriggerWorkflow: false,
      isHidePoweredBy: false,
      themeType: '',
      themeBackgroundColor: '',
      themeBackgroundImageURL: '',
      logoURL: '',
      settingElement: null,
      isSetAllFieldsRequired: false,
      formColumnDescriptionColor: '',
    };
    this.isSettingChanged = false;
    this.timer = null;
  }

  componentDidMount() {
    const { dragDropManager } = this.context;
    const { isValidFormConfig, formConfig } = this.props.getInitFormConfig();

    this.setState({ ...formConfig, isColumnsLoaded: true }, () => {
      if (!isValidFormConfig) {
        this.onSave();
      }
    });
    window.onbeforeunload = this.onSave;
    document.addEventListener('dragover', this.handleDragOver);
    this.clearMonitorSubscription = dragDropManager.getMonitor().subscribeToStateChange(() => this.handleMonitorChange());
  }

  componentWillUnmount() {
    window.onbeforeunload = null;
    document.removeEventListener('dragover', this.handleDragOver);
    this.clearMonitorSubscription();
  }

  handleMonitorChange = () => {
    const { dragDropManager } = this.context;
    const isDragging = dragDropManager.getMonitor().isDragging();

    if (!isDragging && this.scrollTimer) {
      clearInterval(this.scrollTimer);
    }
  };

  handleDragOver = (event) => {
    const { dragDropManager } = this.context;
    const isDragging = dragDropManager.getMonitor().isDragging();
    if (!isDragging) return;

    const { clientY } = event;
    const bottomDistance = this.formContainerRef.offsetHeight - clientY;
    if (clientY <= 100) {
      Utils.debounce(this.scrollUp());
    } else if (bottomDistance <= 100) {
      Utils.debounce(this.scrollDown());
    } else {
      if (this.scrollTimer) clearInterval(this.scrollTimer);
    }
  };

  scrollUp = () => {
    clearInterval(this.scrollTimer);
    this.scrollTimer = setInterval(() => {
      this.formContainerRef.scrollTop = this.formContainerRef.scrollTop - 3;
      if (this.formContainerRef.scrollTop <= 0) {
        clearInterval(this.scrollTimer);
      }
    }, 5);
  };

  scrollDown = () => {
    clearInterval(this.scrollTimer);
    this.scrollTimer = setInterval(() => {
      this.formContainerRef.scrollTop = this.formContainerRef.scrollTop + 3;
      if (this.formContainerRef.clientHeight + this.formContainerRef.scrollTop >= this.formContainerRef.scrollHeight) {
        clearInterval(this.scrollTimer);
      }
    }, 5);
  };

  onSettingBeginSaving = () => {
    this.setState({ isSaving: true, isSaved: false });
  };

  onSettingEndSaving = () => {
    this.setState({ isSaving: false, isSaved: true });
    setTimeout(() => {
      this.setState({ isSaving: false, isSaved: false });
    }, 2000);
  };

  onTableChange = (table) => {
    const currentColumns = getFormConfigColumnsByTable(table);
    this.onSave({ currentColumns, tableId: table._id, elementsOrder: [], staticElements: [], isSetAllFieldsRequired: false });
  };

  onChangeShareFormLinks = (newLinks) => {
    this.onSave({ shareFormLinks: newLinks });
  };

  onColumnChanged = (columnKey, update = {}) => {
    let { currentColumns } = this.state;
    const columnIdx = currentColumns.findIndex(item => item.key === columnKey);
    if (columnIdx === -1) return;
    const currentColumn = currentColumns[columnIdx];
    currentColumns[columnIdx] = Object.assign({}, currentColumn, update);
    this.onSave({ currentColumns });
  };

  onColumnRequiredChanged = (columnKey, update = {}) => {
    let { currentColumns, elementsOrder } = this.state;
    const columnIdx = currentColumns.findIndex(item => item.key === columnKey);
    if (columnIdx === -1) return;
    const currentColumn = currentColumns[columnIdx];
    currentColumns[columnIdx] = Object.assign({}, currentColumn, update);
    const allFieldsRequired = elementsOrder.every(item => {
      if (item.type === FORM_ELEMENTS_TYPE.COLUMN) {
        const column = currentColumns.find(column => column.key === item.key);
        if (column) {
          const { type } = column;
          if (type === CellType.CHECKBOX) {
            return column.require_fill_checked;
          }
          return column.is_required;
        }
        return true;
      }
      return true;
    });
    this.onSave({ currentColumns, isSetAllFieldsRequired: allFieldsRequired });
  };

  onSetAllFieldsCheckedToggle = () => {
    const { isSetAllFieldsRequired, currentColumns, elementsOrder } = this.state;
    elementsOrder.forEach(item => {
      if (item.type === FORM_ELEMENTS_TYPE.COLUMN) {
        const column = currentColumns.find(column => column.key === item.key);
        if (column) {
          const { type } = column;
          if (type === CellType.CHECKBOX) {
            column.require_fill_checked = !isSetAllFieldsRequired;
          }
          column.is_required = !isSetAllFieldsRequired;
        }
      }
    });
    this.setState({ isSetAllFieldsRequired: !isSetAllFieldsRequired, currentColumns });
    this.onSave({ currentColumns, isSetAllFieldsRequired: !isSetAllFieldsRequired });
  };

  onNotificationChange = (notification) => {
    this.onSave({ notification });
  };

  onShareTypeChange = (shareType, selectedGroups) => {
    let groupIds = selectedGroups.map(group => group.id);
    this.onSettingBeginSaving();
    dtableWebAPI.dTableFormShare(token, shareType, groupIds).then(res => {
      this.onSettingEndSaving();
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  onSubmitForm = () => {
    const updatedFormConfig = this.props.getUpdatedFormConfig(this.state);
    dtableWebAPI.updateDTableForm(token, JSON.stringify(updatedFormConfig)).then(res => {
      let trigger_workflow_option = JSON.parse(res.data.form.form_config).trigger_workflow_option;
      let workflowName = trigger_workflow_option.workflow_name;
      let canTriggerWorkflow = trigger_workflow_option.can_trigger_workflow;
      let isTriggerWorkflow = trigger_workflow_option.is_trigger_workflow;
      this.setState({ isTriggerWorkflow, workflowName, canTriggerWorkflow });

      this.onSettingEndSaving();
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  getSubmitLink = () => {
    let slicedTableWebURL = dtableWebURL;
    if (slicedTableWebURL.charAt(slicedTableWebURL.length - 1) === '/') {
      slicedTableWebURL = slicedTableWebURL.slice(0, slicedTableWebURL.length - 1);
    }
    return `${slicedTableWebURL}/dtable/forms/${token}/`;
  };

  onCheckFormPage = () => {
    const formSubmitLink = getFormSubmitLinkByToken(dtableWebURL, token);
    window.open(formSubmitLink);
  };

  renameToggle = () => {
    this.setState({ onRenameToggle: !this.state.onRenameToggle });
  };

  onRenameForm = (event) => {
    let value = event.target.value;
    let { formName } = this.state;
    formName = value.trim() ? value.trim() : formName;
    this.setState({
      onRenameToggle: !this.state.onRenameToggle,
      formName: formName
    }, () => {
      if (!this.state.onRenameToggle) {
        this.onSave();
      }
    });
  };

  onShareDialogToggle = () => {
    this.setState({ isShareFormDialogShow: !this.state.isShareFormDialogShow });
  };

  onSave = (update = {}) => {
    this.setState(update, () => {
      this.onSettingBeginSaving();
      if (!this.isSettingChanged && !this.timer) {
        this.isSettingChanged = true;
        this.timer = setTimeout(() => {
          this.onSubmitForm();
          this.isSettingChanged = false;
          clearTimeout(this.timer);
          this.timer = null;
        }, 3000);
      }
    });
  };

  onFormConfigContentChange = (content, stateName) => {
    this.onSave({ [stateName]: content });
  };

  onFormConfigContentShowToggle = (stateName) => {
    if (stateName === FORM_CONFIG_STATE.IS_TOP_REMARK_CONTENT_SHOW) {
      this.onSave({ [stateName]: !this.state[stateName], topRemarkContent: '' });
    } else {
      this.onSave({ [stateName]: !this.state[stateName], remarkContent: '' });
    }
  };

  onLogoChange = (event) => {
    event.persist();
    const image = event.target.files[0];
    if (!image) return;
    this.uploadFormImage(image, 'form_logo', 'logoURL');
  };

  deleteLogo = () => {
    this.onSave({ logoURL: '' });
  };

  updateSettingElement = (element) => {
    this.setState({ settingElement: element });
  };

  uploadFormImage = (image, customRelativePath, attribute, { uploadProgress, callback } = {}) => {
    dtableWebAPI.getPublicUploadLinkViaFormToken(token).then(res => {
      const { upload_link, parent_path } = res.data;
      const relativePath = customRelativePath ? customRelativePath : '';
      const formData = new FormData();
      formData.append('file', image);
      if (relativePath) {
        formData.append('relative_path', relativePath);
      }
      formData.append('parent_dir', parent_path);
      const uploadLink = upload_link + '?ret-json=1';
      dtableWebAPI.uploadImage(uploadLink, formData, uploadProgress).then(res => {
        const { name } = res.data[0];
        const newFileName = encodeURIComponent(name);
        const url = `${serviceURL}/workspace/${workspaceID}${parent_path}/${relativePath ? relativePath + '/' : ''}${newFileName}`;
        this.onSave({ [attribute]: url });
      }).catch(err => {
        this.handleErr(err);
      });
    }).catch(err => {
      this.handleErr(err);
    });
    callback && callback();
  };

  handleErr = (err) => {
    toaster.danger(Utils.getErrorMsg(err));
  };

  uploadThemeBackgroundImage = (image, callback) => {
    if (!image) return;
    let reader = new FileReader();
    reader.readAsDataURL(image);
    reader.addEventListener('load', () => {
      this.uploadFormImage(image, 'form_background_image', 'themeBackgroundImageURL', { callback });
    }, false);
    reader.addEventListener('error', () => {
      toaster.warning(gettext('Failed to load image'));
    }, false);
  };

  onThemeSettingsChange = (update = {}) => {
    this.onSave(update);
  };

  render() {
    const { tables } = this.props;
    const { isSaved, isSaving, isColumnsLoaded, formName, onRenameToggle, remarkContent, isRemarkContentShow,
      currentColumns, isShareFormDialogShow, tableId, notification, topRemarkContent, isTopRemarkContentShow,
      logoURL, successMessage, successRedirect, isSuccessMessageShow, isSuccessRedirectShow, submitDeadline,
      isSubmitDeadlineShow, isHidePoweredBy, themeType, themeBackgroundColor, themeBackgroundImageURL,
      isTriggerWorkflow, workflowName, canTriggerWorkflow, settingElement, elementsOrder, staticElements, formColumnDescriptionColor
    } = this.state;

    const { shareFormLinks } = this.state;

    if (!isColumnsLoaded) {
      return <Loading />;
    }
    const backgroundColor = getThemeBackgroundColor(themeType, themeBackgroundColor);
    return (
      <Fragment>
        <div className="app-wrapper dtable-edit-form">
          <div className="app-form-header d-flex justify-content-between">
            <div className="form-header-title d-flex align-items-center">
              <i className="form-share-icon dtable-font dtable-icon-form"></i>
              <span className="ml-2">{gettext('Form')}</span>
            </div>
            <div className="form-header-right d-flex align-items-center">
              <div className="form-saving-tip">
                {isSaving && <span className="tip-message">{gettext('Saving...')}</span>}
                {isSaved && <span className="tip-message">{gettext('Saved')}</span>}
              </div>
              <Button color="outline-primary" className="mr-2" onClick={this.onShareDialogToggle}>
                <i className="form-share-icon dtable-font dtable-icon-share mr-2"></i>
                {gettext('Share')}
              </Button>
              <Button color="outline-primary" onClick={this.onCheckFormPage}>
                <i className="form-share-icon dtable-font dtable-icon-form mr-2"></i>
                {gettext('Form page')}
              </Button>
            </div>
          </div>
          <div className="app-main">
            <div className="seatable-share-form" style={{ backgroundColor }} ref={ref => this.formContainerRef = ref}>
              <div className="form-content">
                <AppFormContent
                  isTopRemarkContentShow={isTopRemarkContentShow}
                  isRemarkContentShow={isRemarkContentShow}
                  isHidePoweredBy={isHidePoweredBy}
                  onRenameToggle={onRenameToggle}
                  tableId={tableId}
                  currentColumns={currentColumns}
                  settingElement={settingElement}
                  elementsOrder={elementsOrder}
                  staticElements={staticElements}
                  topRemarkContent={topRemarkContent}
                  remarkContent={remarkContent}
                  formName={formName}
                  logoURL={logoURL}
                  themeType={themeType}
                  themeBackgroundColor={themeBackgroundColor}
                  themeBackgroundImageURL={themeBackgroundImageURL}
                  formColumnDescriptionColor={formColumnDescriptionColor}
                  onSave={this.onSave}
                  onLogoChange={this.onLogoChange}
                  deleteLogo={this.deleteLogo}
                  onColumnChanged={this.onColumnChanged}
                  onRenameForm={this.onRenameForm}
                  renameToggle={this.renameToggle}
                  updateSettingElement={this.updateSettingElement}
                />
              </div>
              <FormFooter isPro={isPro} isHidePoweredBy={isHidePoweredBy} customPoweredBy={customPoweredBy} />
            </div>
            <AppFormSettingsPanel
              currentColumns={currentColumns}
              settingElement={settingElement}
              elementsOrder={elementsOrder}
              staticElements={staticElements}
              formColumnDescriptionColor={formColumnDescriptionColor}
              tables={tables}
              tableId={tableId}
              notification={notification}
              onSave={this.onSave}
              successMessage={successMessage}
              isSuccessMessageShow={isSuccessMessageShow}
              successRedirect={successRedirect}
              isSuccessRedirectShow={isSuccessRedirectShow}
              submitDeadline={submitDeadline}
              isSubmitDeadlineShow={isSubmitDeadlineShow}
              isHidePoweredBy={isHidePoweredBy}
              workflowName={workflowName}
              isTriggerWorkflow={isTriggerWorkflow}
              canTriggerWorkflow={canTriggerWorkflow}
              themeType={themeType}
              themeBackgroundColor={themeBackgroundColor}
              themeBackgroundImageURL={themeBackgroundImageURL}
              onThemeSettingsChange={this.onThemeSettingsChange}
              uploadThemeBackgroundImage={this.uploadThemeBackgroundImage}
              onNotificationChange={this.onNotificationChange}
              onShareTypeChange={this.onShareTypeChange}
              onColumnChanged={this.onColumnChanged}
              onTableChange={this.onTableChange}
              onFormConfigContentChange={this.onFormConfigContentChange}
              onFormConfigContentShowToggle={this.onFormConfigContentShowToggle}
              updateSettingElement={this.updateSettingElement}
              onSetAllFieldsCheckedToggle={this.onSetAllFieldsCheckedToggle}
              isSetAllFieldsRequired={this.state.isSetAllFieldsRequired}
              onColumnRequiredChanged={this.onColumnRequiredChanged}
            />
          </div>
        </div>
        {isShareFormDialogShow && (
          <ShareFormDialog
            link={this.getSubmitLink()}
            formName={formName}
            columns={currentColumns}
            shareFormLinks={shareFormLinks}
            elementsOrder={elementsOrder}
            onChangeShareFormLinks={this.onChangeShareFormLinks}
            onShareDialogToggle={this.onShareDialogToggle}
          />
        )}
      </Fragment>
    );
  }
}

AppMain.propTypes = {
  tables: PropTypes.array.isRequired,
  getInitFormConfig: PropTypes.func.isRequired,
  getUpdatedFormConfig: PropTypes.func.isRequired,
};

export default html5DragDropContext(AppMain);
