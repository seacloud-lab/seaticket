import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { LongTextEditorDialog } from '@seafile/seafile-editor';
import { toaster } from 'dtable-ui-component';
import FormRemarkTextColorSettings from '../widgets/form-remark-text-color-settings';
import FormRemarkBackgroundColorSettings from '../widgets/form-remark-background-color-settings';
import LongTextEditorUtils from '../../../components-form/utils/long-text-editor-utils';
import { FORM_REMARK_DEFAULT_TEXT_COLOR, FORM_REMARK_DEFAULT_BACKGROUND_COLOR } from '../../../constants/form-constants';
import { isLongTextValueExceedLimit } from '../../../components-form/utils/utils';

const gettext = window.gettext;

const { workspaceID, token, dtableWebURL } = window.shared.pageOptions;

class AppRemarkSettingsContent extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowLongTextEditor: false,
    };
    this._editorUtils = new LongTextEditorUtils({
      editorType: 'remark-description',
      token,
      dtableWebURL,
      workspaceID,
      apiUploadLinkName: 'getUploadLinkViaFormToken'
    });
  }

  toggleContentEditor = (event) => {
    event && event.stopPropagation();
    this.setState({ isShowLongTextEditor: !this.state.isShowLongTextEditor });
  };

  isLongTextValueValid = (value) => {
    if (isLongTextValueExceedLimit(value)) {
      const message = gettext('The content of the document has exceeded the limit of 100000 characters, and the content cannot be saved');
      toaster.closeAll();
      toaster.danger(message, { duration: null });
      return false;
    }
    return true;
  };

  onEditRemark = (value) => {
    if (!this.isLongTextValueValid(value)) return;
    let { staticElements, settingElement } = this.props;
    const targetIdx = staticElements.findIndex(option => option.key === settingElement.key);
    staticElements[targetIdx].value = value.text;
    this.props.onSave({ staticElements });
  };

  onCloseEditorDialog = (value) => {
    // value has no changed, no need to save
    if (!value) {
      this.setState({ isShowLongTextEditor: false });
      return;
    }
    // value is changed and value is valid
    if (this.isLongTextValueValid(value)) {
      this.onEditRemark(value);
      this.setState({ isShowLongTextEditor: false });
      return;
    }
    // value is invalid
    // nothing todo
  };

  onChangeTextColor = (updated) => {
    let { staticElements, settingElement } = this.props;
    const targetIdx = staticElements.findIndex(option => option.key === settingElement.key);
    staticElements[targetIdx].text_color = updated ? updated.text_color : FORM_REMARK_DEFAULT_TEXT_COLOR;
    this.props.onSave({ staticElements });
  };

  onChangeBackgroundColor = (updated) => {
    let { staticElements, settingElement } = this.props;
    const targetIdx = staticElements.findIndex(option => option.key === settingElement.key);
    staticElements[targetIdx].background_color = updated ? updated.background_color : FORM_REMARK_DEFAULT_BACKGROUND_COLOR;
    this.props.onSave({ staticElements });
  };

  render() {
    const { settingElement, staticElements } = this.props;
    const { isShowLongTextEditor } = this.state;
    const targetElement = staticElements.find(element => element.key === settingElement.key);

    return (
      <>
        <div className="form-filed-setting-item">
          <div className="form-set-help-text" onClick={this.toggleContentEditor}>
            <span className="ml-2">{gettext('Edit')}</span>
          </div>
        </div>
        <FormRemarkTextColorSettings
          titleContent={gettext('Text color')}
          styleConfigData={{ text_color: targetElement.text_color || FORM_REMARK_DEFAULT_TEXT_COLOR }}
          onChanged={this.onChangeTextColor}
        />
        <FormRemarkBackgroundColorSettings
          styleConfigData={{ background_color: targetElement.background_color || FORM_REMARK_DEFAULT_BACKGROUND_COLOR }}
          onChanged={this.onChangeBackgroundColor}
        />
        {isShowLongTextEditor && (
          <LongTextEditorDialog
            headerName={gettext('Notes')}
            value={targetElement.value || ''}
            editorApi={this._editorUtils}
            autoSave={true}
            saveDelay={10 * 1000}
            onSaveEditorValue={this.onEditRemark}
            onCloseEditorDialog={this.onCloseEditorDialog}
          />
        )}
      </>
    );
  }
}

AppRemarkSettingsContent.propTypes = {
  settingElement: PropTypes.object,
  staticElements: PropTypes.array,
  onSave: PropTypes.func,
};

export default AppRemarkSettingsContent;
