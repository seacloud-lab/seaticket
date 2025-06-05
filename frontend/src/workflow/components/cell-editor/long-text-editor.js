import React from 'react';
import PropTypes from 'prop-types';
import deepcopy from 'deep-copy';
import MediaQuery from 'react-responsive';
import { CellType } from 'dtable-utils';
import { getPreviewContent } from '@seafile/seafile-editor';
import { isWeiXinBuiltInBrowser } from '../../../components-form/utils/utils';
import LongTextEditorNormal from '../../../components-form/cell-editor-widgets/long-text-editor/long-text-editor-normal';
import LongTextEditorFallback from '../../../components-form/cell-editor-widgets/long-text-editor/long-text-editor-fallback';
import MobileLongTextEditor from '../../../components-form/cell-viewer-mobile/mobile-long-text-editor';
import LongTextEditorUtils from '../../../components-form/utils/long-text-editor-utils';
import ValueEmpty from '../../components/common/value-empty';
import { transferAssetURL, transferAssetURLBack } from '../../utils/asset';

import '../../../components-form/cell-css/long-text.css';

class LongTextEditor extends React.Component {

  static defaultProps = {
    isReadOnly: false,
    isSubmitting: false,
    value: { text: '', preview: '' }
  };

  constructor(props) {
    super(props);
    const { editorConfig } = props;
    const { token, dtableWebURL, workspaceID, taskId } = editorConfig || {};
    this._editorUtils = new LongTextEditorUtils({
      editorType: 'column-value',
      token,
      taskId,
      dtableWebURL,
      workspaceID,
      apiUploadLinkName: 'getUploadLinkViaWorkflowToken',
    });
    this._isWeiXinBuiltInBrowser = isWeiXinBuiltInBrowser();
  }

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
    updated[column.key] = this.transferLongTextBack(updated[column.key]);
    this.props.onCommit(updated);
  };

  transferLongTextBack = (value) => {
    const valueType = Object.prototype.toString.call(value);
    let newValue;
    if (valueType === '[object String]') {
      let { images } = getPreviewContent(newValue);
      newValue = { images, text: value };
    } else {
      newValue = value;
    }
    let { images } = newValue;
    if (!images || images.length === 0) return newValue;
    newValue.images = images.map(img => {
      let newImg = transferAssetURLBack(img);
      newValue.text = newValue.text.replace(img, newImg);
      return newImg;
    });
    return newValue;
  };

  transferLongText = () => {
    const { value, column, editorConfig } = this.props;
    let newValue = deepcopy(value);
    const valueType = Object.prototype.toString.call(newValue);
    if (valueType === '[object String]') {
      const { images } = getPreviewContent(newValue);
      newValue = { images, text: newValue };
    }
    const { images } = newValue;
    if (!images || images.length === 0) return newValue;
    const { token: workflowToken, taskId } = editorConfig;
    const newImages = images.map(img => {
      const newImg = transferAssetURL(img, workflowToken, taskId, column.key, CellType.LONG_TEXT);
      newValue.text = newValue.text.replace(img, newImg);
      return newImg;
    });
    newValue.images = newImages;
    return newValue;
  };

  render() {
    const { isReadOnly, value } = this.props;
    let isValidValue = true;
    const valueType = Object.prototype.toString.call(value);
    if (valueType === '[object String]') {
      isValidValue = value && value.trim() ? true : false;
    } else if (valueType === '[object Object]') {
      isValidValue = value.text && value.text.trim() ? true : false;
    } else {
      isValidValue = false;
    }
    if (isReadOnly && !isValidValue) {
      return (
        <div className="cell-editor grid-cell-type-long-text">
          <ValueEmpty />
        </div>
      );
    }
    const transferedValue = this.transferLongText();
    const props = { ...this.props, value: transferedValue };
    return (
      <div className="cell-editor grid-cell-type-long-text">
        <MediaQuery query="(min-width: 768px)">
          {this._isWeiXinBuiltInBrowser ?
            <LongTextEditorFallback {...props} onCommit={this.onCommit} />
            :
            <LongTextEditorNormal {...props} editorUtils={this._editorUtils} onCommit={this.onCommit} />
          }
        </MediaQuery>
        <MediaQuery query="(max-width: 767.8px)">
          <MobileLongTextEditor {...props} onCommit={this.onCommit} />
        </MediaQuery>
      </div>
    );
  }
}

LongTextEditor.propTypes = {
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  isSupportPreview: PropTypes.bool,
  value: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  column: PropTypes.object,
  isEditorShow: PropTypes.bool,
  editorConfig: PropTypes.object,
  updateTabIndex: PropTypes.func,
  onCommit: PropTypes.func,
};

export default LongTextEditor;
