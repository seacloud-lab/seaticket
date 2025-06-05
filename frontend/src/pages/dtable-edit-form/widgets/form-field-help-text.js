import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { LongTextEditorDialog } from '@seafile/seafile-editor';
import { toaster } from 'dtable-ui-component';
import LongTextEditorUtils from '../../../components-form/utils/long-text-editor-utils';
import { isLongTextValueExceedLimit } from '../../../components-form/utils/utils';

const gettext = window.gettext;
const { workspaceID, token, dtableWebURL } = window.shared.pageOptions;

class FormFieldHelpText extends Component {

  constructor(props) {
    super(props);
    const { column } = this.props;
    this.state = {
      columnKey: column.key,
      isShowLongTextEditor: false,
      description: column.description || '',
    };
    this._editorUtils = new LongTextEditorUtils({
      editorType: 'column-description',
      token,
      dtableWebURL,
      workspaceID,
      apiUploadLinkName: 'getUploadLinkViaFormToken'
    });
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    const { column } = nextProps;
    if (column.key !== prevState.columnKey) {
      return {
        columnKey: column.key,
        description: column.description,
      };
    } else if (column.description !== prevState.description) {
      return {
        description: column.description
      };
    }
    return null;
  }

  isLongTextValueValid = (value) => {
    if (isLongTextValueExceedLimit(value)) {
      const message = gettext('The content of the document has exceeded the limit of 100000 characters, and the content cannot be saved');
      toaster.closeAll();
      toaster.danger(message, { duration: null });
      return false;
    }
    return true;
  };

  onChangeDescription = (value) => {
    if (!this.isLongTextValueValid(value)) return;
    const { description: oldDescription, columnKey } = this.state;
    const { text } = value || {};
    const description = (typeof text === 'string' && text.trim()) || '';
    if (description !== oldDescription) {
      this.setState({ description }, () => {
        this.props.onColumnChanged(columnKey, { description });
      });
    }
  };

  onCloseEditorDialog = (value) => {
    // value has no changed, no need to save
    if (!value) {
      this.setState({ isShowLongTextEditor: false });
      return;
    }
    // value is changed and value is valid
    if (this.isLongTextValueValid(value)) {
      this.onChangeDescription(value);
      this.setState({ isShowLongTextEditor: false });
      return;
    }
    // value is invalid
    // nothing todo
  };

  toggleLongTextEditor = () => {
    this.setState({ isShowLongTextEditor: !this.state.isShowLongTextEditor });
  };

  render() {
    const { description, isShowLongTextEditor } = this.state;

    return (
      <Fragment>
        <div className="form-filed-setting-item">
          <div className="form-filed-label">{gettext('Help text')}</div>
          <div className="form-set-help-text" onClick={this.toggleLongTextEditor}>
            <span className="ml-2">{gettext('Edit help text')}</span>
          </div>
        </div>
        {isShowLongTextEditor && (
          <LongTextEditorDialog
            headerName={gettext('Help text')}
            value={description}
            editorApi={this._editorUtils}
            autoSave={false}
            onSaveEditorValue={this.onChangeDescription}
            onCloseEditorDialog={this.onCloseEditorDialog}
          />
        )}
      </Fragment>
    );
  }
}

FormFieldHelpText.propTypes = {
  column: PropTypes.object,
  onColumnChanged: PropTypes.func,
};

export default FormFieldHelpText;
