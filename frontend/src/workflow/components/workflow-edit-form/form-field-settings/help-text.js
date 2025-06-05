import React from 'react';
import PropTypes from 'prop-types';
import { LongTextEditorDialog } from '@seafile/seafile-editor';
import { toaster } from 'dtable-ui-component';
import { COLUMN_CONFIG_KEY } from '../../../constants';
import LongTextEditorUtils from '../../../../components-form/utils/long-text-editor-utils';
import { isLongTextValueExceedLimit } from '../../../../components-form/utils/utils';

const propTypes = {
  column: PropTypes.object,
  onColumnChanged: PropTypes.func,
};

const { workspaceID, token, dtableWebURL } = window.shared.pageOptions;

const gettext = window.gettext;

class HelpText extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      description: props.column.description || '',
      isShowLongTextEditor: false,
    };
  }

  _editorUtils = new LongTextEditorUtils({
    editorType: 'column-description',
    token,
    dtableWebURL,
    workspaceID,
    apiUploadLinkName: 'getPublicUploadLinkViaWorkflowToken'
  });

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.column.key !== this.props.column.key || nextProps.column.description !== this.props.column.description) {
      this.setState({
        description: nextProps.column.description
      });
    }
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
    const { column } = this.props;
    const { text } = value || {};
    const description = (typeof text === 'string' && text.trim()) || '';
    if (description !== column[COLUMN_CONFIG_KEY.DESCRIPTION]) {
      this.setState({ description }, () => {
        this.props.onColumnChanged(column.key, { [COLUMN_CONFIG_KEY.DESCRIPTION]: description });
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
      <div className="filed-setting-item help-text">
        <div className="filed-label">{gettext('Help text')}</div>
        <div className="set-help-text" onClick={this.toggleLongTextEditor}>
          <span className="add-new-option ml-2">{gettext('Edit help text')}</span>
        </div>
        {isShowLongTextEditor && (
          <LongTextEditorDialog
            headerName={gettext('Help text')}
            value={description}
            editorApi={this._editorUtils}
            autoSave={true}
            saveDelay={10 * 1000}
            onSaveEditorValue={this.onChangeDescription}
            onCloseEditorDialog={this.onCloseEditorDialog}
          />
        )}
      </div>
    );
  }
}

HelpText.propTypes = propTypes;

export default HelpText;
