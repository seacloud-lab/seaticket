import React, { createRef } from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import { LongTextInlineEditor } from '@seafile/seafile-editor';
import { isLongTextValueExceedLimit } from '../../../../utils/utils';
import { gettext, lang } from '../../../../../utils/constants';

class Editor extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      value: '',
    };
    this.editorRef = createRef();
  }

  componentDidMount() {
    this.convertMarkdown(this.props.value);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const { value, isEditorShow: nextIsEditorShow } = nextProps;
    const { value: oldValue, isEditorShow } = this.props;
    if (value !== oldValue) {
      this.setState({ isLoading: true });
      this.convertMarkdown(value);
    }

    if (isEditorShow && !nextIsEditorShow) {
      this.closeEditor();
    }

    if (!isEditorShow && nextIsEditorShow) {
      this.openEditor();
    }
  }

  convertMarkdown = (value) => {
    let newValue = { text: '' };
    if (typeof value === 'string') {
      newValue = { text: value };
    } else if (value && value.text) {
      newValue = value;
    }
    this.setState({ value: newValue, isLoading: false });
  };

  onSaveEditorValue = (value) => {
    if (isLongTextValueExceedLimit(value)) {
      const message = gettext('The content of the document has exceeded the limit of 100000 characters, and the content cannot be saved');
      toaster.closeAll();
      toaster.danger(message, { duration: null });
      return;
    }
    this.props.onCommit(value);
    this.isLongTextValueChanged = false;
  };

  openEditor = () => {
    this.editorRef.current.openEditor();
  };

  closeEditor = () => {
    this.editorRef.current.closeEditor();
  };

  onClick = () => {
    const { columnIndex } = this.props;
    this.props.updateTabIndex && this.props.updateTabIndex(columnIndex);
  };

  render() {
    const { column } = this.props;
    const { isLoading, value } = this.state;
    if (isLoading) return null;

    return (
      <LongTextInlineEditor
        ref={this.editorRef}
        lang={lang}
        headerName={column.name}
        value={value.text}
        autoSave={true}
        saveDelay={20 * 1000}
        isCheckBrowser={true}
        onClick={this.onClick}
        editorApi={this.props.editorUtils}
        onSaveEditorValue={this.onSaveEditorValue}
      />
    );
  }
}

Editor.propTypes = {
  onCommit: PropTypes.func,
  column: PropTypes.object,
  expandedRow: PropTypes.object,
  t: PropTypes.func,
  isEditorFocus: PropTypes.bool,
  columnIndex: PropTypes.number,
  updateTabIndex: PropTypes.func,
};

export default Editor;
