import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import MobileUpload from '../../cell-viewer-mobile/mobile-upload';
import { gettext } from '../../../utils/constants';
import Progress from './upload-progress';

import '../../cell-css/file-editor-view.css';

const propTypes = {
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  isUploading: PropTypes.bool,
  value: PropTypes.array,
  thumbnailSrcObj: PropTypes.object,
  uploadPercentObj: PropTypes.object,
  handleImagesChange: PropTypes.func,
  deleteImage: PropTypes.func,
};

class MobileLocalImageAddition extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isImageTipShow: false,
      isShowLargeImage: false,
      largeImageIndex: -1,
      images: [],
      isShowMobileUploaded: false
    };
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    const { value } = nextProps;
    if (value.length !== prevState.images.length) {
      if (value.length === 0) {
        return {
          images: [],
          largeImageIndex: -1,
          isShowLargeImage: false,
        };
      }
      if (value.length < prevState.largeImageIndex + 1) {
        return {
          largeImageIndex: value.length - 1,
          images: value
        };
      }
      if (value.length > 0) {
        return {
          images: value
        };
      }
    }
    return null;
  }

  handleImagesChange = (event) => {
    if (this.props.isReadOnly || this.props.isSubmitting) return;
    event.persist();
    this.props.handleImagesChange(event.target.files);
  };

  deleteImage = () => {
    this.props.deleteImage(this.state.largeImageIndex);
  };

  fileUploadClick = () => {
    if (this.props.isReadOnly || this.props.isSubmitting) return;
    this.setState({ isShowMobileUploaded: !this.state.isShowMobileUploaded });
  };

  onInputFile = (event) => {
    event.stopPropagation();
  };

  render() {
    let imageArr = [];
    let { value, isUploading, thumbnailSrcObj, uploadPercentObj } = this.props;
    const { isShowMobileUploaded } = this.state;
    if (Array.isArray(value)) {
      imageArr.push(
        <div className="mobile-image-editor-wrapper"
          key={'image-wrapper-addition'}
          onClick={this.fileUploadClick}
        >
          <div className="mobile-image-tip-addition">
            <div className="mobile-image-add-icon">
              {isShowMobileUploaded &&
                <MobileUpload
                  handleFilesChange={this.handleImagesChange}
                  togglePreviewer={this.fileUploadClick}
                />
              }
            </div>
            <Fragment>
              <i className="dtable-font dtable-icon-add-table"></i>
              <span className="mobile-image-add-span">{gettext('Upload')}</span>
            </Fragment>
          </div>
        </div>
      );

      if (isUploading) {
        for (let key in uploadPercentObj) {
          const uploadPercent = uploadPercentObj[key];
          imageArr.push(
            <div className="mobile-image-wrapper" key={`${key}-image-wrapper-circle`}>
              <div className="image-upload-percent">
                <img src={thumbnailSrcObj[key]} style={{ position: 'absolute', zIndex: uploadPercent === 100 ? 3 : 1 }} alt="" />
                {uploadPercent < 100 &&
                  <Progress
                    uploadPercent={uploadPercent}
                  />
                }
                {uploadPercent === 100 &&
                  <div className="image-upload-success">
                    <div className="image-upload-success-scale">
                      <span className="image-upload-success-icon">
                        <i className="dtable-font dtable-icon-check-mark"></i>
                      </span>
                      <span className="image-upload-success-tip">{gettext('Uploaded completed')}</span>
                    </div>
                  </div>
                }
                <div className="image-upload-mask"></div>
              </div>
            </div>
          );
        }
      }
    }
    return imageArr;
  }
}

MobileLocalImageAddition.propTypes = propTypes;

export default MobileLocalImageAddition;
