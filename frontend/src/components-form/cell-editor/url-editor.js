import React from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import { isValidUrl } from '../utils/utils';
import TextEditorDropdown from '../cell-editor-widgets/text-editor-dropdown';

import '../cell-css/text-editor.css';
import '../cell-css/url-editor.css';

const gettext = window.gettext;

const propTypes = {
  isReadOnly: PropTypes.bool,
  value: PropTypes.string,
};

class UrlEditor extends React.Component {

  onOpenUrlLink = () => {
    const { value } = this.props;
    let newValue = value.trim();
    if (!isValidUrl(newValue)) {
      newValue = `http://${newValue}`;
    }
    try {
      let a = document.createElement('a');
      document.body.appendChild(a);
      a.href = newValue;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
      document.body.removeChild(a);
    } catch {
      toaster.danger(gettext('URL is invalid'));
    }
  };

  renderEditor = () => {
    const { isReadOnly, value } = this.props;
    if (isReadOnly) {
      const validValue = value || '';
      return (
        <div
          className="form-control text-truncate url-container readOnly"
          title={validValue}
        >
          {validValue}
        </div>
      );
    }
    return <TextEditorDropdown {...this.props}/>;
  };

  render() {
    const { value } = this.props;
    return (
      <div className="cell-editor grid-cell-type-text url-editor">
        <div className="text-editor-container">
          {this.renderEditor()}
          {(value && value.trim()) &&
            <span
              aria-hidden="true"
              className="dtable-font dtable-icon-url row-expand-jump-link"
              onClick={this.onOpenUrlLink}
            >
            </span>
          }
        </div>
      </div>
    );
  }

}

UrlEditor.propTypes = propTypes;

export default UrlEditor;
