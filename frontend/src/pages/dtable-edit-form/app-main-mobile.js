import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { ActionSheet } from 'antd-mobile';
import { CellType } from 'dtable-utils';
import { toaster } from 'dtable-ui-component';
import html5DragDropContext from '../../utils/html5DragDropContext';
import Loading from '../../components/loading';
import { Utils } from '../../utils/utils';
import { dtableWebAPI } from '../../api/dtable-web-api';
import ShareDialogQRCode from './dialog/share-dialog-qr-code';
import AppFormContent from './app-form-content';
import AppFormSettingsMobile from './form-settings-panel/app-form-settings-mobile';
import { isPro } from '../../utils/constants';
import { getFormConfigColumnsByTable, getFormSubmitLinkByToken } from '../../utils/form-utils';
import MobileCommonHeader from '../../components/mobile/mobile-common-header';
import FormPoweredMobile from '../../components-form/mobile/form-powered-mobile';
import { FORM_CONFIG_STATE, FORM_ELEMENTS_TYPE } from '../../constants/form-constants';

import '../../css/mobile/mobile-dtable-edit-form.css';

const gettext = window.gettext;
const { token, dtableWebURL, customPoweredBy, workspaceID } = window.shared.pageOptions;
const { serviceURL } = window.app.config;

class AppMainMobile extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isColumnsLoaded: false,
      onRenameToggle: false,
      isShareFormDialogShow: false,
      showSetting: false,
      currentColumns: [],
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
      isHidePoweredBy: false,
      themeType: '',
      themeBackgroundColor: '',
      themeBackgroundImageURL: '',
      logoURL: '',
      elementsOrder: [],
      staticElements: [],
      formColumnDescriptionColor: '',
      settingColumn: null,
      isSetAllFieldsRequired: false,
    };
    this.isSettingChanged = false;
    this.timer = null;
    this.startX = 0;
    this.startY = 0;
  }

  componentDidMount() {
    const { isValidFormConfig, formConfig } = this.props.getInitFormConfig();
    this.setState({ ...formConfig, isColumnsLoaded: true }, () => {
      if (!isValidFormConfig) {
        this.onSave();
      }
    });
    window.onbeforeunload = this.onSave;
  }

  componentWillUnmount() {
    window.onbeforeunload = null;
  }

  onTableChange = (table) => {
    const currentColumns = getFormConfigColumnsByTable(table);
    this.onSave({ currentColumns, tableId: table._id, elementsOrder: [], staticElements: [], isSetAllFieldsRequired: false });
  };

  onColumnChanged = (columnKey, update = {}) => {
    const { currentColumns } = this.state;
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
    dtableWebAPI.dTableFormShare(token, shareType, groupIds).then(res => {
      toaster.success(gettext('All changes saved'));
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  onSubmitForm = () => {
    const updatedFormConfig = this.props.getUpdatedFormConfig(this.state);
    dtableWebAPI.updateDTableForm(token, JSON.stringify(updatedFormConfig)).then(res => {
      toaster.success(gettext('All changes saved'));
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

  toggleSetting = () => {
    this.setState({ showSetting: !this.state.showSetting });
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
      const error = Utils.getErrorMsg(err);
      toaster.danger(error);
    });
    callback && callback();
  };

  onLogoChange = (event) => {
    event.persist();
    let image = event.target.files[0];
    if (!image) return;
    this.uploadFormImage(image, 'form_logo', 'logoURL');
  };

  deleteLogo = () => {
    this.onSave({ logoURL: '' });
  };

  handleTouchStart = (e) => {
    this.startX = e.touches[0].pageX;
    this.startY = e.touches[0].pageY;
  };

  handleTouchMove = (e) => {
    const moveX = e.touches[0].pageX - this.startX;
    const moveY = e.touches[0].pageY - this.startY;
    if (Math.abs(moveY) > Math.abs(moveX)) return;
    if (moveX < 35) return;
    this.containerRef.style.transform = 'translateX(300px)';
    this.setState({ showSetting: !this.state.showSetting });
  };

  showFormActionSheet = () => {
    const buttons = [
      <div className="my-am-action" onClick={this.toggleSetting}>
        <i className="dtable-font dtable-icon-set-up"></i>
        {gettext('Settings')}
      </div>,
      <div className="my-am-action" onClick={this.onShareDialogToggle}>
        <i className="dtable-font dtable-icon-share"></i>
        {gettext('Share')}
      </div>,
      <div className="my-am-action" onClick={this.onCheckFormPage}>
        <i className="dtable-font dtable-icon-form"></i>
        {gettext('Form page')}
      </div>,
    ];
    ActionSheet.showActionSheetWithOptions({
      options: buttons,
      maskClosable: true,
      className: 'dtable-antd-mobile seatable-edit-form-antd-mobile'
    });
  };

  updateSettingColumn = (column) => {
    this.setState({ settingColumn: column });
  };

  render() {
    const { tables } = this.props;
    const { isColumnsLoaded, formName, onRenameToggle, remarkContent, isRemarkContentShow, showSetting,
      currentColumns, isShareFormDialogShow, tableId, notification, topRemarkContent, isTopRemarkContentShow, logoURL,
      successMessage, successRedirect, isSuccessMessageShow, isSuccessRedirectShow, submitDeadline, isSubmitDeadlineShow,
      isHidePoweredBy, themeType, themeBackgroundColor, themeBackgroundImageURL, elementsOrder, staticElements,
      settingColumn, formColumnDescriptionColor } = this.state;
    if (!isColumnsLoaded) {
      return <Loading />;
    }

    return (
      <Fragment>
        <div className="app-wrapper dtable-edit-form dtable-edit-form-mobile">
          <div className="app-main">
            <div className="seatable-share-form">
              <MobileCommonHeader
                titleClass="seatable-edit-form-mobile-header"
                title={gettext('Form')}
                rightName={<i className='dtable-font dtable-icon-more-level'></i>}
                rightStyle={{ color: '#666666' }}
                onRightClick={this.showFormActionSheet}
              />
              <div className="dtable-edit-form-content-container">
                <div className="form-content">
                  <AppFormContent
                    isTopRemarkContentShow={isTopRemarkContentShow}
                    isRemarkContentShow={isRemarkContentShow}
                    isHidePoweredBy={isHidePoweredBy}
                    onRenameToggle={onRenameToggle}
                    tableId={tableId}
                    currentColumns={currentColumns}
                    elementsOrder={elementsOrder}
                    staticElements={staticElements}
                    settingColumn={settingColumn}
                    remarkContent={remarkContent}
                    topRemarkContent={topRemarkContent}
                    formColumnDescriptionColor={formColumnDescriptionColor}
                    formName={formName}
                    themeType={themeType}
                    themeBackgroundColor={themeBackgroundColor}
                    themeBackgroundImageURL={themeBackgroundImageURL}
                    logoURL={logoURL}
                    onColumnChanged={this.onColumnChanged}
                    onColumnRequiredChanged={this.onColumnRequiredChanged}
                    onFormConfigContentChange={this.onFormConfigContentChange}
                    onRenameForm={this.onRenameForm}
                    renameToggle={this.renameToggle}
                    onLogoChange={this.onLogoChange}
                    deleteLogo={this.deleteLogo}
                    updateSettingElement={this.updateSettingColumn}
                  />
                </div>
                <FormPoweredMobile
                  isPro={isPro}
                  isHidePoweredBy={isHidePoweredBy}
                  customPoweredBy={customPoweredBy}
                />
              </div>
            </div>
            {showSetting && (
              <Fragment>
                <div className="edit-form-mask" onClick={this.toggleSetting}></div>
                <div
                  className="app-side-container"
                  ref={ref => this.containerRef = ref}
                  onTouchStart={this.handleTouchStart}
                  onTouchMove={this.handleTouchMove}
                >
                  <AppFormSettingsMobile
                    currentColumns={currentColumns}
                    elementsOrder={elementsOrder}
                    staticElements={staticElements}
                    onColumnChanged={this.onColumnChanged}
                    onTableChange={this.onTableChange}
                    tables={tables}
                    onNotificationChange={this.onNotificationChange}
                    onShareTypeChange={this.onShareTypeChange}
                    tableId={tableId}
                    notification={notification}
                    onSave={this.onSave}
                    remarkContent={remarkContent}
                    isRemarkContentShow={isRemarkContentShow}
                    topRemarkContent={topRemarkContent}
                    isTopRemarkContentShow={isTopRemarkContentShow}
                    successMessage={successMessage}
                    isSuccessMessageShow={isSuccessMessageShow}
                    successRedirect={successRedirect}
                    isSuccessRedirectShow={isSuccessRedirectShow}
                    submitDeadline={submitDeadline}
                    isSubmitDeadlineShow={isSubmitDeadlineShow}
                    isHidePoweredBy={isHidePoweredBy}
                    formColumnDescriptionColor={formColumnDescriptionColor}
                    onFormConfigContentChange={this.onFormConfigContentChange}
                    onFormConfigContentShowToggle={this.onFormConfigContentShowToggle}
                    onSetAllFieldsCheckedToggle={this.onSetAllFieldsCheckedToggle}
                    isSetAllFieldsRequired={this.state.isSetAllFieldsRequired}
                  />
                </div>
              </Fragment>
            )}
          </div>
        </div>
        {isShareFormDialogShow &&
          <ShareDialogQRCode
            shareCancel={this.onShareDialogToggle}
            icon={<i className={'dtable-font dtable-icon-form share-item-inner-icon'}></i>}
            link={this.getSubmitLink()}
            name={formName}
            qrText={gettext('Scan QR code to open form')}
          />
        }
      </Fragment>
    );
  }
}

AppMainMobile.propTypes = {
  tables: PropTypes.array.isRequired,
  getInitFormConfig: PropTypes.func.isRequired,
  getUpdatedFormConfig: PropTypes.func.isRequired,
};

export default html5DragDropContext(AppMainMobile);
