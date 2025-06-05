import React from 'react';
import PropTypes from 'prop-types';
import ImageItem from '../cell-editor-widgets/file-image-edit/image-item';
import { dtableWebAPI } from '../../api/dtable-web-api';
import { getFileIconUrl } from '../utils/utils';
import LocalFileAddition from '../cell-editor-widgets/file-image-edit/local-file-addition';
import MobileLocalFileAddition from '../cell-editor-widgets/file-image-edit/mobile-local-file-addition';
import { Utils } from '../../utils/utils';
import { gettext } from '../../utils/constants';

import '../cell-css/file-editor.css';

const FileEditorPropTypes = {
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
  column: PropTypes.object,
  onCommit: PropTypes.func,
  isEditorShow: PropTypes.bool,
  updateTabIndex: PropTypes.func,
};

const { dtableName: fileName, workspaceID, dtableWebURL, token } = window.shared.pageOptions;
const { serviceURL, mediaUrl } = window.app.config;
const config = {
  server: dtableWebURL ? dtableWebURL.replace(/\/+$/, '') : '',
  workspaceID,
  fileName,
  mediaUrl: serviceURL + mediaUrl,
};

class FileEditor extends React.Component {

  static defaultProps = {
    isReadOnly: false,
    value: []
  };

  constructor(props) {
    super(props);
    this.state = {
      newValue: props.value,
      isUpdated: false,
      uploadPercentObj: {},
      isUploading: false,
      thumbnailSrcObj: {},
      enterFileIndex: -1,
    };
    const offsetWidth = document.body.offsetWidth;
    this.containerSize = offsetWidth < 767.8 ? ((offsetWidth - 60 ) / 3) + 'px' : null;
  }

  changeCurrentIndex = (index, e) => {
    if (this.props.isSubmitting) return;
    if (e.target.className === 'share-form-item-file' || e.target.tagName.toLowerCase() === 'img') {
      this.setState({ enterFileIndex: index });
    }
  };

  hideDeleteIcon = () => {
    this.setState({ enterFileIndex: -1 });
  };

  getFormatValue = () => {
    const { mediaUrl } = config;
    const { column } = this.props;
    let fileArr = [];
    let { newValue, enterFileIndex } = this.state;
    if (Array.isArray(newValue) && newValue.length > 0) {
      newValue.forEach((fileItem, index) => {
        let iconUrl = getFileIconUrl(mediaUrl, fileItem.name, fileItem.type);
        fileArr.push(
          <div
            key={`file-${index}`}
            className="share-form-item-file"
            onMouseEnter={(e) => this.changeCurrentIndex(index, e)}
            onMouseLeave={this.hideDeleteIcon}
            style={this.containerSize ? { width: this.containerSize, height: this.containerSize } : {}}
            id={`item-file-${column.key}-${index}`}
          >
            <ImageItem
              src={iconUrl}
              targetId={`item-file-${column.key}-${index}`}
              name={fileItem.name}
              showDeleteIcon={enterFileIndex === index}
              deleteImage={this.deleteFile}
              index={index}
              deleteTip={gettext('Are you sure you want to delete this file?')}
            />
          </div>
        );
      });
    }
    return fileArr;
  };

  deleteFile = (index) => {
    let value = this.state.newValue.slice(0);
    value.splice(index, 1);
    this.setState({
      isUpdated: true,
      newValue: value
    }, () => {
      let { column, onCommit } = this.props;
      let updated = { [column.key]: value };
      onCommit(updated);
    });
  };

  handleFilesChange = (files) => {
    let { mediaUrl } = config;
    const total = files.length;
    let thumbnailSrcObj = {};
    for (let i = 0; i < total; i++) {
      let src = getFileIconUrl(mediaUrl, files[i].name, files[i].type);
      thumbnailSrcObj[files[i].name] = src;
    }
    this.setState({
      isUploading: true,
      isUpdated: true,
      thumbnailSrcObj: thumbnailSrcObj,
    });
    let updated = 0;
    for (let i = 0; i < total; i++) {
      const file = files[i];
      this.uploadLocalFile(file).then((response) => {
        let value = this.state.newValue.slice(0);
        value.push(response);
        let uploadPercentObj = this.state.uploadPercentObj;
        delete uploadPercentObj[file.name];
        this.setState({
          newValue: value,
          enterFileIndex: value.length,
          uploadPercentObj,
        }, () => {
          this.checkUpload(total, ++updated, value);
        });
      }).catch(err => {
        this.checkUpload(total, ++updated);
      });
    }
  };

  checkUpload = (total, uploaded, value) => {
    if (total === uploaded) {
      const { newValue, isUpdated } = this.state;
      if (isUpdated) {
        const { column, onCommit } = this.props;
        let updated = { [column.key]: value ? value : newValue };
        onCommit(updated);
      }
      this.setState({
        isUploading: false,
        uploadPercentObj: {},
        thumbnailSrcObj: {},
      });
    }
  };

  uploadLocalFile = (imageFile) => {
    let parentPath = '';
    return (
      dtableWebAPI.getUploadLinkViaFormToken(token, 'file').then((res) => {
        const { upload_link, parent_path } = res.data;
        const uploadLink = upload_link + '?ret-json=1';
        parentPath = parent_path;
        const formData = new FormData();
        formData.append('parent_dir', parentPath);
        formData.append('file', imageFile, imageFile.name);
        return dtableWebAPI.uploadImage(uploadLink, formData, (e) => {this.onUploadProgress(e, imageFile.name);});
      }).then ((res) => {
        return this.setFileMessage(res.data[0].name, parentPath, res.data[0].size);
      })
    );
  };

  onUploadProgress = (event, name) => {
    let { loaded, total } = event;
    let uploadPercent = Math.floor(loaded / total * 100);
    const uploadPercentObj = { ...this.state.uploadPercentObj };
    uploadPercentObj[name] = uploadPercent;
    this.setState({ uploadPercentObj });
  };

  setFileMessage(fileName, path, size) {
    const { server, workspaceID } = config;
    const url = server + '/workspace/' + workspaceID + path + '/' + encodeURIComponent(fileName);
    return {
      url,
      size,
      name: fileName,
      type: 'file',
    };
  }

  renderFileModal = () => {
    let { newValue, uploadPercentObj, isUploading, thumbnailSrcObj } = this.state;
    const { isRequired } = this.props;
    return (
      <LocalFileAddition
        handleFilesChange={this.handleFilesChange}
        value={newValue}
        uploadPercentObj={uploadPercentObj}
        isUploading={isUploading}
        deleteFile={this.deleteFile}
        thumbnailSrcObj={thumbnailSrcObj}
        isReadOnly={this.props.isReadOnly}
        isEditorShow={this.props.isEditorShow}
        isSubmitting={this.props.isSubmitting}
        column={this.props.column}
        isRequired={isRequired}
      />
    );
  };

  renderMobileFileModal = () => {
    let { newValue, uploadPercentObj, isUploading, thumbnailSrcObj } = this.state;
    return (
      <MobileLocalFileAddition
        handleFilesChange={this.handleFilesChange}
        value={newValue}
        uploadPercentObj={uploadPercentObj}
        isUploading={isUploading}
        deleteFile={this.deleteFile}
        thumbnailSrcObj={thumbnailSrcObj}
        isReadOnly={this.props.isReadOnly}
        isSubmitting={this.props.isSubmitting}
      />
    );
  };

  render() {
    let value = this.getFormatValue();
    const isDesktop = Utils.isDesktop();
    return (
      <div className="cell-editor grid-cell-type-file">
        <div className="form-file-container">
          {isDesktop && this.renderFileModal()}
          {!isDesktop && this.renderMobileFileModal()}
          {value}
        </div>
      </div>
    );
  }
}

FileEditor.propTypes = FileEditorPropTypes;

export default FileEditor;
