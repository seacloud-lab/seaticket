import React from 'react';
import PropTypes from 'prop-types';
import { CellType } from 'dtable-utils';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import { getFileIconUrl } from '../../../components-form/utils/utils';
import ImageItem from '../../../components-form/cell-editor-widgets/file-image-edit/image-item';
import LocalFileAddition from '../../../components-form/cell-editor-widgets/file-image-edit/local-file-addition';
import MobileLocalFileAddition from '../../../components-form/cell-editor-widgets/file-image-edit/mobile-local-file-addition';
import ValueEmpty from '../../components/common/value-empty';
import { transferAssetPreviewURL } from '../../utils/asset';
import { Utils } from '../../../utils/utils';
import { gettext } from '../../../utils/constants';

import '../../../components-form/cell-css/file-editor.css';

class FileEditor extends React.Component {

  static defaultProps = {
    isReadOnly: false,
    value: [],
    canViewFile: false
  };

  constructor(props) {
    super(props);
    this.state = {
      newValue: props.value || [],
      isPopoverShow: props.isEditorShow || false,
      isUpdated: false,
      uploadPercentObj: {},
      isUploading: false,
      thumbnailSrcObj: {},
      enterFileIndex: -1,
    };
    const offsetWidth = document.body.offsetWidth;
    this.containerSize = offsetWidth < 767.8 ? ((offsetWidth - 60 ) / 3) + 'px' : null;
  }

  onAddFileToggle = (event) => {
    if (event) {
      event.stopPropagation();
    }
    let { isPopoverShow, isUpdated, newValue } = this.state;
    if (isPopoverShow && isUpdated) {
      const { column, onCommit } = this.props;
      let updated = { [column.key]: newValue };
      onCommit(updated);
    }
    this.setState({ isPopoverShow: !isPopoverShow });
  };

  closeEditor = () => {
    this.setState({ isPopoverShow: false });
  };

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.isEditorShow !== this.props.isEditorShow) {
      this.setState({ isPopoverShow: nextProps.isEditorShow });
    }
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

  onClickDeleteIcon = (index, e) => {
    e.stopPropagation();
    this.deleteFile(index);
  };

  onClickFile = (url) => {
    const isDesktop = Utils.isDesktop();
    if (isDesktop) {
      this.openFile(url);
    }
  };

  openFile = (url) => {
    const { canViewFile, editorConfig, column, isReadOnly } = this.props;
    const { token, taskId } = editorConfig;
    if (!canViewFile || !token || !taskId) {
      return;
    }
    window.open(transferAssetPreviewURL(url, token, taskId, column.key, CellType.FILE, isReadOnly));
  };

  downloadFile = (downloadUrl) => {
    location.href = downloadUrl;
  };

  getFormatValue = () => {
    const { editorConfig, isReadOnly, column } = this.props;
    const { mediaUrl = '/media/' } = editorConfig || {};
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
            onClick={this.onClickFile.bind(this, fileItem.url)}
            id={`item-file-${column.key}-${index}`}
          >
            <ImageItem
              src={iconUrl}
              targetId={`item-file-${column.key}-${index}`}
              name={fileItem.name}
              url={fileItem.url}
              showDeleteIcon={!isReadOnly && enterFileIndex === index}
              showViewIcon={enterFileIndex === index}
              showDownloadIcon={enterFileIndex === index}
              deleteImage={this.deleteFile}
              openFile={this.openFile}
              downloadFile={this.downloadFile}
              index={index}
              deleteTip={gettext('Are you sure you want to delete this file?')}
            />
          </div>
        );
      });
    }
    return fileArr;
  };

  onFileEditorToggle = () => {
    if (this.props.isReadOnly || this.props.isSubmitting) return;
    this.setState({ isPopoverShow: !this.state.isPopoverShow }, () => {
      if (this.props.updateTabIndex) {
        this.props.updateTabIndex();
      }
    });
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
    const { editorConfig } = this.props;
    const { mediaUrl } = editorConfig;
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
          this.checkUpload(total, ++updated);
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
    const { editorConfig } = this.props;
    const { token, taskId } = editorConfig;
    let parentPath = '';
    return (
      dtableWebAPI.getUploadLinkViaWorkflowToken(token, 'file', taskId).then((res) => {
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
    const { editorConfig } = this.props;
    const { dtableWebURL, workspaceID } = editorConfig;
    const url = dtableWebURL + '/workspace/' + workspaceID + path + '/' + encodeURIComponent(fileName);
    return {
      url,
      size,
      name: fileName,
      type: 'file',
    };
  }

  renderFileModal = () => {
    const { newValue, uploadPercentObj, isUploading, thumbnailSrcObj } = this.state;
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

  onMobileCommit = (updated, column) => {
    let newValue = updated[column.key];
    this.setState({ newValue });
    this.props.onCommit(updated, column);
  };

  renderAddContent = (value) => {
    const { isReadOnly } = this.props;
    if (!isReadOnly || (Array.isArray(value) && value.length > 0)) return null;
    return (<ValueEmpty />);
  };

  render() {
    const value = this.getFormatValue();
    const { isReadOnly } = this.props;
    const isDesktop = Utils.isDesktop();
    return (
      <div className="cell-editor grid-cell-type-file">
        {this.renderAddContent()}
        <div className={`form-file-container ${isReadOnly ? 'readOnly' : ''}`}>
          {isDesktop && !isReadOnly && this.renderFileModal()}
          {!isDesktop && this.renderMobileFileModal()}
          {value}
        </div>
      </div>
    );
  }
}

FileEditor.propTypes = {
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  canViewFile: PropTypes.bool,
  isEditorShow: PropTypes.bool,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
  column: PropTypes.object,
  editorConfig: PropTypes.object,
  onCommit: PropTypes.func,
  updateTabIndex: PropTypes.func,
};

export default FileEditor;
