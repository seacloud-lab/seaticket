import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../../utils/constants';
import Progress from './upload-progress';

const propTypes = {
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  isUploading: PropTypes.bool,
  value: PropTypes.array,
  thumbnailSrcObj: PropTypes.object,
  uploadPercentObj: PropTypes.object,
  deleteFile: PropTypes.func,
  handleFilesChange: PropTypes.func,
};

class MobileLocalFileAddition extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowMobileUploaded: false
    };
  }

  handleFilesChange = (event) => {
    if (this.props.isReadOnly || this.props.isSubmitting) return;
    event.persist();
    this.props.handleFilesChange(event.target.files);
  };

  deleteFile = (index) => {
    this.props.deleteFile(index);
  };

  fileUploadClick = () => {
    if (this.props.isReadOnly || this.props.isSubmitting) return;
    this.fileRef.click();
    this.setState({ isShowMobileUploaded: !this.state.isShowMobileUploaded });
  };

  onInputFile = (event) => {
    event.stopPropagation();
  };

  calculateFileArr = () => {
    let fileArr = [];
    let { value, isUploading, thumbnailSrcObj, uploadPercentObj } = this.props;
    if (Array.isArray(value)) {
      fileArr.push(
        <div className='mobile-file-editor-wrapper'
          key={'file-wrapper-addition'}
          onClick={this.fileUploadClick}
        >
          <div className="mobile-file-tip-addition">
            <div className="mobile-file-add-icon">
              <input
                type="file"
                ref={ref => this.fileRef = ref}
                multiple
                className='upload-file'
                name="upload-file"
                aria-label='upload-file'
                onClick={this.onInputFile}
                onChange={this.handleFilesChange}
              />
            </div>
            <Fragment>
              <i className="dtable-font dtable-icon-enlarge"></i>
              <span className="mobile-file-add-span">{gettext('Upload')}</span>
            </Fragment>
          </div>
        </div>
      );
      if (isUploading) {
        for (let key in uploadPercentObj) {
          const uploadPercent = uploadPercentObj[key];
          let fileIconUrl = thumbnailSrcObj[key];
          fileArr.push(
            <div className="mobile-file-wrapper" key={`${key}-file-wrapper-circle`} >
              <div className="file-upload-percent">
                <img src={fileIconUrl} style={{ position: 'absolute', zIndex: uploadPercent === 100 ? 3 : 1 }} alt="" />
                {uploadPercent < 100 &&
                  <Progress
                    uploadPercent={uploadPercent}
                  />
                }
                {uploadPercent === 100 &&
                  <div className="file-upload-success">
                    <div className="file-upload-success-scale">
                      <span className="file-upload-success-icon">
                        <i className="dtable-font dtable-icon-check-mark"></i>
                      </span>
                      <span className="file-upload-success-tip">{gettext('Uploaded completed')}</span>
                    </div>
                  </div>
                }
                <div className="file-upload-mask"></div>
              </div>
            </div>
          );
        }
      }
    }
    return fileArr;
  };

  render() {
    return this.calculateFileArr();
  }
}

MobileLocalFileAddition.propTypes = propTypes;

export default MobileLocalFileAddition;
