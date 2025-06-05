import React from 'react';
import PropTypes from 'prop-types';
import { ActionSheet } from 'antd-mobile';
import { gettext } from '../../utils/constants';

import '../cell-css/mobile-upload.css';

const propTypes = {
  handleFilesChange: PropTypes.func,
  togglePreviewer: PropTypes.func,
};

const PREVIEWER = 'previewer';

class MobileUpload extends React.Component {

  constructor(props) {
    super(props);
    this.ActionSheet = ActionSheet;
  }

  componentDidMount() {
    this.showActionSheet();
  }

  componentWillUnmount() {
    this.ActionSheet.close();
    this.ActionSheet = null;
  }

  handleFilesChange = (e) => {
    e.persist();
    this.props.handleFilesChange(e);
    this.props.togglePreviewer(PREVIEWER);
  };

  onInputFile = (e) => {
    e.nativeEvent.stopImmediatePropagation();
    e.stopPropagation();
  };

  showActionSheet = () => {
    const iconStyle = { lineHeight: '56px' };
    const buttons = [
      <div className="my-am-action d-flex justify-content-between">
        <span>{gettext('Take a photo')}</span>
        <i className="dtable-font dtable-icon-camera" style={iconStyle}></i>
      </div>,
      <div className="my-am-action d-flex justify-content-between">
        <span>{gettext('Browse documents')}</span>
        <i className="dtable-font dtable-icon-more-level" style={iconStyle}></i>
      </div>,
      <div className="my-am-action d-flex justify-content-center">{gettext('Cancel')}</div>,
    ];
    this.ActionSheet.showActionSheetWithOptions({
      className: 'dtable-antd-mobile-mobile-upload',
      options: buttons,
      cancelButtonIndex: 3,
      maskClosable: true
    }, this.onPressBtn);
  };

  onPressBtn = (index) => {
    if (index === 0) {
      this.refs.camera_upload_image.click();
    } else if (index === 1) {
      this.refs.upload_image.click();
    } else {
      this.props.togglePreviewer(PREVIEWER);
    }
  };

  render() {
    return (
      <div className="h-0 o-hidden">
        <input
          multiple
          type="file"
          accept="image/*"
          ref='upload_image'
          onClick={this.onInputFile}
          onChange={this.handleFilesChange}
        />
        <input
          type="file"
          capture="camera"
          accept="image/*"
          ref='camera_upload_image'
          onClick={this.onInputFile}
          onChange={this.handleFilesChange}
        />
      </div>
    );
  }
}

MobileUpload.propTypes = propTypes;

export default MobileUpload;
