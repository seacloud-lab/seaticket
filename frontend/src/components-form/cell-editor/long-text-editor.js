import React from 'react';
import PropTypes from 'prop-types';
import MediaQuery from 'react-responsive';
import { isWeiXinBuiltInBrowser } from '../utils/utils';
import LongTextEditorNormal from '../cell-editor-widgets/long-text-editor/long-text-editor-normal';
import LongTextEditorFallback from '../cell-editor-widgets/long-text-editor/long-text-editor-fallback';
import MobileLongTextEditor from '../cell-viewer-mobile/mobile-long-text-editor';
import LongTextEditorUtils from '../utils/long-text-editor-utils';

import '../cell-css/long-text.css';

const { workspaceID, token, dtableWebURL } = window.shared.pageOptions;

const propTypes = {
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  isSupportPreview: PropTypes.bool,
  apiUploadLinkName: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  column: PropTypes.object,
  onCommit: PropTypes.func,
  isEditorShow: PropTypes.bool,
  updateTabIndex: PropTypes.func,
};

class LongTextEditor extends React.Component {

  static defaultProps = {
    isReadOnly: false,
    isSubmitting: false,
    apiUploadLinkName: 'getUploadLinkViaFormToken',
    value: { text: '', preview: '' }
  };

  _isWeiXinBuiltInBrowser = isWeiXinBuiltInBrowser();

  _editorUtils = new LongTextEditorUtils({
    editorType: 'column-value',
    token,
    dtableWebURL,
    workspaceID,
    apiUploadLinkName: this.props.apiUploadLinkName
  });

  onCommit = (newValue) => {
    let updated = {};
    let column = this.props.column;
    let type = Object.prototype.toString.call(newValue);
    if (type === '[object Object]') {
      updated[column.key] = newValue;
    } else if (type === '[object String]') {
      updated[column.key] = {
        text: newValue,
        preview: newValue ? newValue.slice(0, 30) : '',
        links: [],
        images: [],
      };
    }
    this.props.onCommit(updated);
  };

  render() {
    return (
      <div className="cell-editor grid-cell-type-long-text">
        <MediaQuery query="(min-width: 768px)">
          {this._isWeiXinBuiltInBrowser ?
            <LongTextEditorFallback {...this.props} onCommit={this.onCommit} />
            :
            <LongTextEditorNormal {...this.props} editorUtils={this._editorUtils} onCommit={this.onCommit} />
          }
        </MediaQuery>
        <MediaQuery query="(max-width: 767.8px)">
          <MobileLongTextEditor {...this.props} onCommit={this.onCommit} />
        </MediaQuery>
      </div>
    );
  }
}

LongTextEditor.propTypes = propTypes;

export default LongTextEditor;
