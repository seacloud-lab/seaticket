import React from 'react';
import { Input } from 'reactstrap';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import isHotkey from 'is-hotkey';
import { gettext } from '../../../utils/constants';
import Progress from './upload-progress';

const propTypes = {
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  isEditorShow: PropTypes.bool,
  isUploading: PropTypes.bool,
  value: PropTypes.array,
  column: PropTypes.object.isRequired,
  thumbnailSrcObj: PropTypes.object,
  uploadPercentObj: PropTypes.object,
  handleImagesChange: PropTypes.func,
  deleteImage: PropTypes.func,
};

class LocalImageAddition extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isImageTipShow: false,
      isSupportPasteImg: false,
      isShowLargeImage: false,
      largeImageIndex: -1,
      images: [],
    };
    this.enteredCounter = 0; // Determine whether to enter the child element to avoid dragging bubbling bugs。
  }

  componentDidMount() {
    document.addEventListener('keydown', this.onKeyDown);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onKeyDown);
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

  onKeyDown = (event) => {
    event.stopPropagation();
    if (isHotkey('enter', event) && this.props.isEditorShow) {
      this.fileUploadClick();
    }
  };

  handleImagesChange = (event) => {
    if (this.props.isReadOnly || this.props.isSubmitting) return;
    event.persist();
    this.props.handleImagesChange(event.target.files);
  };

  deleteImage = () => {
    this.props.deleteImage(this.state.largeImageIndex);
  };

  fileDragEnter = (event) => {
    if (this.props.isReadOnly || this.props.isSubmitting) return;
    event.preventDefault();
    this.enteredCounter++;
    if (this.enteredCounter !== 0) {
      this.setState({ isImageTipShow: true });
    }
  };

  fileDragOver = (event) => {
    event.stopPropagation();
    event.preventDefault();
  };

  fileDragLeave = () => {
    if (this.props.isReadOnly || this.props.isSubmitting) return;
    this.enteredCounter--;
    if (this.enteredCounter === 0) {
      this.setState({ isImageTipShow: false });
    }
  };

  fileDrop = (event) => {
    if (this.props.isReadOnly || this.props.isSubmitting) return;
    event.stopPropagation();
    event.preventDefault();
    event.persist();
    const { handleImagesChange } = this.props;
    this.enteredCounter = 0;
    this.setState({ isImageTipShow: false });
    let files = event.dataTransfer.files;
    let uploadFileList = [];
    let dealFileCnt = 0;
    let allFileLen = files.length;
    function checkLoadFinish() {
      if (dealFileCnt === allFileLen - 1) {
        if (handleImagesChange) handleImagesChange(uploadFileList);
      }
      dealFileCnt++;
    }
    for (let i = 0; i < allFileLen; i++) {
      let uploadFile = files[i];
      try {
        let fileReader = new FileReader();
        fileReader.readAsDataURL(uploadFile);
        fileReader.addEventListener('load', function (event) {
          let isImage = /image/i.test(uploadFile.type);
          if (isImage) {
            uploadFileList.push(uploadFile);
            checkLoadFinish();
          }
        }, false);
        fileReader.addEventListener('error', function (e) {
          checkLoadFinish();
        }, false);
      } catch (error) {
        checkLoadFinish();
      }
    }
  };

  fileUploadClick = () => {
    if (this.props.isReadOnly || this.props.isSubmitting) return;
    this.refs.image_file.click();
  };

  onInputFile = (event) => {
    event.stopPropagation();
  };

  onPaste = (event) => {
    event.stopPropagation();
    let files = event.clipboardData.files;
    const len = files.length;
    let imageFiles = [];
    for (let i = 0; i < len; i++) {
      const file = files[i];
      if (/image/i.test(file.type)) imageFiles.push(files[i]);
    }
    if (imageFiles.length > 0) {
      this.props.handleImagesChange(imageFiles);
    }
  };

  onMouseEnter = () => {
    this.setState({ isSupportPasteImg: true });
  };

  onMouseLeave = () => {
    this.setState({ isSupportPasteImg: false });
  };

  render() {
    let imageArr = [];
    let { isImageTipShow } = this.state;
    let { value, isUploading, thumbnailSrcObj, uploadPercentObj, isEditorShow, column } = this.props;
    if (Array.isArray(value)) {
      let imageTips = isImageTipShow ?
        <span className="image-add-span">{gettext('Drag and drop here to upload images')}</span> :
        (
          <>
            <i className="dtable-font dtable-icon-add-table"></i>
            <span className="image-add-span">{gettext('Upload')}</span>
          </>
        );
      imageArr.push(
        <div
          className={classnames('image-editor-wrapper', { 'image-editor-wrapper-active': isImageTipShow || isEditorShow })}
          key={'image-wrapper-addition'}
          onMouseEnter={this.onMouseEnter}
          onMouseLeave={this.onMouseLeave}
          onDragEnter={this.fileDragEnter}
          onDragOver={this.fileDragOver}
          onDragLeave={this.fileDragLeave}
          onDrop={this.fileDrop}
          onClick={this.fileUploadClick}
          onPaste={this.onPaste}
          aria-label={gettext('Add image to {column_name} field').replace('{column_name}', column.name) + (this.props.isRequired ? ', ' + gettext('Required') : '')}
          tabIndex={0}
        >
          <div className={classnames('image-tip-addition', { 'image-drop-active': isImageTipShow })}>
            <div className='image-add-icon'>
              <input
                multiple
                type="file"
                name={gettext('Add image to {column_name} field').replace('{column_name}', column.name)}
                title={gettext('Add image to {column_name} field').replace('{column_name}', column.name)}
                className='upload-image'
                accept="image/*"
                ref='image_file'
                onClick={this.onInputFile}
                onChange={this.handleImagesChange}
              />
            </div>
            {imageTips}
            {this.state.isSupportPasteImg && <Input className="image-editor-paste" autoFocus={true} />}
          </div>
        </div>
      );

      if (isUploading) {
        for (let key in uploadPercentObj) {
          const uploadPercent = uploadPercentObj[key];
          imageArr.push(
            <div className="image-wrapper" key={`${key}-image-wrapper-circle`}>
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

LocalImageAddition.propTypes = propTypes;

export default LocalImageAddition;
