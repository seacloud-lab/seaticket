import React, { Fragment } from 'react';
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
  column: PropTypes.object,
  thumbnailSrcObj: PropTypes.object,
  uploadPercentObj: PropTypes.object,
  deleteFile: PropTypes.func,
  handleFilesChange: PropTypes.func,
};

class LocalFileAddition extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isFileTipShow: false,
      enterFileIndex: -1
    };
    this.enteredCounter = 0; // Determine whether to enter the child element to avoid dragging bubbling bugs。
  }

  componentDidMount() {
    document.addEventListener('keydown', this.onKeyDown);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onKeyDown);
  }

  onKeyDown = (event) => {
    if (isHotkey('enter', event) && this.props.isEditorShow) {
      event.preventDefault();
      event.stopPropagation();
      this.fileUploadClick();
    }
  };

  handleFilesChange = (event) => {
    if (this.props.isReadOnly || this.props.isSubmitting) return;
    event.persist();
    this.props.handleFilesChange(event.target.files);
  };

  deleteFile = (index) => {
    this.props.deleteFile(index);
  };

  fileDragEnter = (event) => {
    if (this.props.isReadOnly || this.props.isSubmitting) return;
    event.preventDefault();
    this.enteredCounter++;
    if (this.enteredCounter !== 0) {
      this.setState({ isFileTipShow: true });
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
      this.setState({ isFileTipShow: false });
    }
  };

  fileDrop = (event) => {
    if (this.props.isReadOnly || this.props.isSubmitting) return;
    event.stopPropagation();
    event.preventDefault();
    event.persist();
    const { handleFilesChange } = this.props;
    this.enteredCounter = 0;
    this.setState({ isFileTipShow: false });
    let files = event.dataTransfer.files;
    let uploadFileList = [];
    let dealFileCnt = 0;
    let allFileLen = files.length;
    function checkLoadFinish() {
      if (dealFileCnt === allFileLen - 1) {
        if (handleFilesChange) handleFilesChange(uploadFileList);
      }
      dealFileCnt++;
    }
    for (let i = 0; i < allFileLen; i++) {
      let uploadFile = files[i];
      try {
        let fileReader = new FileReader();
        fileReader.readAsDataURL(uploadFile);
        fileReader.addEventListener('load', function (event) {
          uploadFileList.push(uploadFile);
          checkLoadFinish();
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
    this.fileRef.click();
  };

  onInputFile = (event) => {
    event.stopPropagation();
  };

  showDeleteIcon = (index) => {
    this.setState({ enterFileIndex: index });
  };

  hideDeleteIcon = () => {
    this.setState({ enterFileIndex: -1 });
  };

  calculateFileArr = () => {
    let fileArr = [];
    let { value, isUploading, thumbnailSrcObj, uploadPercentObj, isEditorShow, column, isRequired } = this.props;
    let { isFileTipShow } = this.state;
    const airaLabel = isRequired ? gettext('Add file to {column_name} field').replace('{column_name}', column.name) + ', ' + gettext('Required') : gettext('Add file to {column_name} field').replace('{column_name}', column.name);
    if (Array.isArray(value)) {
      let fileTips = isFileTipShow ?
        <span className="file-add-span">{gettext('Drag and drop here to upload files')}</span> :
        <Fragment>
          <i className="dtable-font dtable-icon-enlarge"></i>
          <span className="file-add-span">{gettext('Upload')}</span>
        </Fragment>;
      fileArr.push(
        <div
          className={classnames('file-editor-wrapper', { 'file-editor-wrapper-active': isFileTipShow || isEditorShow })}
          key={'file-wrapper-addition'}
          onDragEnter={this.fileDragEnter}
          onDragOver={this.fileDragOver}
          onDragLeave={this.fileDragLeave}
          onDrop={this.fileDrop}
          onClick={this.fileUploadClick}
          aria-label={airaLabel}
          tabIndex={0}
        >
          <div className={classnames('file-tip-addition', { 'file-drop-active': isFileTipShow })}>
            <div className='file-add-icon'>
              <input
                type="file"
                ref={ref => this.fileRef = ref}
                multiple
                className='upload-file'
                name={gettext('Add file to {column_name} field').replace('{column_name}', column.name)}
                title={gettext('Add file to {column_name} field').replace('{column_name}', column.name)}
                onClick={this.onInputFile}
                onChange={this.handleFilesChange}
                aria-hidden="true"
                tabIndex={-1}
              />
            </div>
            {fileTips}
          </div>
        </div>
      );
      if (isUploading) {
        for (let key in uploadPercentObj) {
          const uploadPercent = uploadPercentObj[key];
          let fileIconUrl = thumbnailSrcObj[key];
          fileArr.push(
            <div className="file-wrapper" key={`${key}-file-wrapper-circle`} >
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

LocalFileAddition.propTypes = propTypes;

export default LocalFileAddition;
