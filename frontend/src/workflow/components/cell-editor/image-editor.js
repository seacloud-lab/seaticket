import React from 'react';
import PropTypes from 'prop-types';
import { CellType } from 'dtable-utils';
import { ImagePreviewerLightbox } from 'dtable-ui-component';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import { getFileIconUrl, imageNameFilter } from '../../../components-form/utils/utils';
import ImageItem from '../../../components-form/cell-editor-widgets/file-image-edit/image-item';
import LocalImageAddition from '../../../components-form/cell-editor-widgets/file-image-edit/local-image-addition';
import MobileLocalImageAddition from '../../../components-form/cell-editor-widgets/file-image-edit/mobile-local-image-addition';
import ValueEmpty from '../../components/common/value-empty';
import { transferAssetURL, transferAssetURLBack } from '../../utils/asset';
import { Utils } from '../../../utils/utils';

import '../../../components-form/cell-css/image-editor.css';

class ImageEditor extends React.Component {

  static defaultProps = {
    isReadOnly: false,
    isSubmitting: false,
    value: []
  };

  constructor(props) {
    super(props);
    this.state = {
      newValue: this.transferURLs(props.value || []),
      isPopoverShow: props.isEditorShow || false,
      isUpdated: false,
      isUploading: false,
      thumbnailSrcObj: {},
      uploadPercentObj: {},
      enterImageIndex: -1,
    };
    const offsetWidth = document.body.offsetWidth;
    this.containerSize = offsetWidth < 767.8 ? ((offsetWidth - 60 ) / 3) + 'px' : null;
  }

  transferURLs = (urls) => {
    const { editorConfig, column } = this.props;
    const { token: workflowToken, taskId } = editorConfig;
    if (!urls || urls.length === 0) return [];
    return urls.map(url => {
      if (!(workflowToken && taskId)) return url;
      // /dtable/workflow means that url has been transfered or it is a workflow form url
      if (url.indexOf('/dtable/workflow') === -1) {
        return transferAssetURL(url, workflowToken, taskId, column.key, CellType.IMAGE);
      }
      return url;
    });
  };

  transferURLsBack = (urls) => {
    if (!urls || urls.length === 0) return [];
    return urls.map(url => {
      return transferAssetURLBack(url);
    });
  };

  onCommit = (updated) => {
    const { column } = this.props;
    updated[column.key] = this.transferURLsBack(updated[column.key]);
    this.props.onCommit(updated);
  };

  onAddImageToggle = (event) => {
    if (event) {
      event.stopPropagation();
    }
    let { isPopoverShow, isUpdated, newValue } = this.state;
    if (isPopoverShow && isUpdated) {
      const { column } = this.props;
      let updated = { [column.key]: newValue };
      this.onCommit(updated);
    }
    this.setState({ isPopoverShow: !isPopoverShow });
  };

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.isEditorShow !== this.props.isEditorShow) {
      this.setState({ isPopoverShow: nextProps.isEditorShow });
    }
  }

  changeCurrentIndex = (index, e) => {
    if (this.props.isSubmitting) return;
    if (e.target.className === 'share-form-item-image' || e.target.tagName.toLowerCase() === 'img') {
      this.setState({ enterImageIndex: index });
    }
  };

  hideDeleteIcon = () => {
    this.setState({ enterImageIndex: -1 });
  };

  onImageClick = (index, e) => {
    if (e.target.tagName.toLowerCase() === 'img' || e.target.className === 'share-form-item-image') {
      this.setState({
        isShowLargeImage: true,
        largeImageIndex: index
      });
    }
  };

  hideLargeImage = () => {
    this.setState({
      isShowLargeImage: false,
      largeImageIndex: -1,
    });
  };

  moveNext = () => {
    let images = this.state.newValue;
    this.setState(prevState => ({
      largeImageIndex: (prevState.largeImageIndex + 1) % images.length,
    }));
  };

  movePrev = () => {
    let images = this.state.newValue;
    this.setState(prevState => ({
      largeImageIndex: (prevState.largeImageIndex + images.length - 1) % images.length,
    }));
  };

  getFormatValue = () => {
    let fileArr = [];
    const { isReadOnly, column } = this.props;
    let { newValue, enterImageIndex } = this.state;

    if (Array.isArray(newValue) && newValue.length > 0) {
      newValue.forEach((imageItem, index) => {
        let name = decodeURI(imageItem.slice(imageItem.lastIndexOf('/') + 1, imageItem.indexOf('?')));
        fileArr.push(
          <div
            key={`image-${index}`}
            className="share-form-item-image"
            onMouseEnter={(e) => this.changeCurrentIndex(index, e)}
            onMouseLeave={this.hideDeleteIcon}
            onClick={(e) => {this.onImageClick(index, e);}}
            style={this.containerSize ? { width: this.containerSize, height: this.containerSize } : {}}
            id={`item-image-${column.key}-${index}`}
          >
            <ImageItem
              src={imageItem}
              targetId={`item-image-${column.key}-${index}`}
              name={name}
              showDeleteIcon={!isReadOnly && enterImageIndex === index}
              deleteImage={this.deleteImage}
              index={index}
            />
          </div>
        );
      });
    }
    return fileArr;
  };

  onImageEditorToggle = () => {
    if (this.props.isReadOnly || this.props.isSubmitting) return;
    this.setState({ isPopoverShow: !this.state.isPopoverShow }, () => {
      if (this.props.updateTabIndex) {
        this.props.updateTabIndex();
      }
    });
  };

  deleteImage = (index) => {
    let value = this.state.newValue.slice(0);
    value.splice(index, 1);
    if (this.state.isShowLargeImage) {
      if (value.length === 0) {
        this.setState({
          largeImageIndex: -1,
          isShowLargeImage: false,
        });
      }
      if (value.length < this.state.largeImageIndex + 1) {
        this.setState({
          largeImageIndex: value.length - 1,
        });
      }
    }
    this.setState({
      isUpdated: true,
      newValue: value,
      enterImageIndex: -1,
    }, () => {
      let { column } = this.props;
      let updated = { [column.key]: value };
      this.onCommit(updated);
    });
  };

  handleImagesChange = (files) => {
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
          newValue: this.transferURLs(value),
          enterImageIndex: value.length,
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
        const { column } = this.props;
        let updated = { [column.key]: value ? value : newValue };
        this.onCommit(updated);
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
      dtableWebAPI.getUploadLinkViaWorkflowToken(token, 'image', taskId).then((res) => {
        const { upload_link, parent_path } = res.data;
        const uploadLink = upload_link + '?ret-json=1';
        const formData = new FormData();
        parentPath = parent_path;
        formData.append('parent_dir', parentPath);
        const imageName = imageNameFilter(imageFile.name);
        formData.append('file', imageFile, imageName);
        return dtableWebAPI.uploadImage(uploadLink, formData, (e) => {this.onUploadProgress(e, imageFile.name);});
      }).then ((res) => {
        return this.getImageUrl(parentPath, res.data[0].name);
      })
    );
  };

  getImageUrl(path, fileName) {
    const { editorConfig } = this.props;
    const { dtableWebURL, workspaceID } = editorConfig;
    const url = dtableWebURL + '/workspace/' + workspaceID + path + '/' + encodeURIComponent(fileName);
    return url;
  }

  onUploadProgress = (event, name) => {
    let { loaded, total } = event;
    let uploadPercent = Math.floor(loaded / total * 100);
    const uploadPercentObj = { ...this.state.uploadPercentObj };
    uploadPercentObj[name] = uploadPercent;
    this.setState({ uploadPercentObj });
  };

  onMobileCommit = (updated, column) => {
    let newValue = updated[column.key];
    this.setState({ newValue: this.transferURLs(newValue) });
    this.onCommit(updated, column);
  };

  renderImageModal() {
    let { newValue, uploadPercentObj, isUploading, thumbnailSrcObj } = this.state;
    return (
      <LocalImageAddition
        handleImagesChange={this.handleImagesChange}
        value={newValue}
        uploadPercentObj={uploadPercentObj}
        isUploading={isUploading}
        deleteImage={this.deleteImage}
        thumbnailSrcObj={thumbnailSrcObj}
        isReadOnly={this.props.isReadOnly}
        isSubmitting={this.props.isSubmitting}
        column={this.props.column}
      />
    );
  }

  renderMobileImageModal = () => {
    let { newValue, uploadPercentObj, isUploading, thumbnailSrcObj } = this.state;
    return (
      <MobileLocalImageAddition
        handleImagesChange={this.handleImagesChange}
        value={newValue}
        uploadPercentObj={uploadPercentObj}
        isUploading={isUploading}
        deleteImage={this.deleteImage}
        thumbnailSrcObj={thumbnailSrcObj}
        isReadOnly={this.props.isReadOnly}
        isSubmitting={this.props.isSubmitting}
      />
    );
  };


  renderAddContent = (value) => {
    if (!this.props.isReadOnly || (Array.isArray(value) && value.length > 0)) return null;
    return (<ValueEmpty />);
  };

  render() {
    const value = this.getFormatValue();
    const { isReadOnly } = this.props;
    const isDesktop = Utils.isDesktop();

    return (
      <div className="cell-editor grid-cell-type-image">
        {this.renderAddContent(value)}
        <div className={`form-image-container ${isReadOnly ? 'readOnly' : ''}`}>
          {isDesktop && !isReadOnly && this.renderImageModal()}
          {!isDesktop && this.renderMobileImageModal()}
          {value}
        </div>
        {this.state.isShowLargeImage &&
          <ImagePreviewerLightbox
            readOnly={isReadOnly}
            imageItems={this.state.newValue}
            imageIndex={this.state.largeImageIndex}
            closeImagePopup={this.hideLargeImage}
            moveToPrevImage={this.movePrev}
            moveToNextImage={this.moveNext}
            deleteImage={() => {this.deleteImage(this.state.largeImageIndex);}}
          />
        }
      </div>
    );
  }
}

ImageEditor.propTypes = {
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
  column: PropTypes.object,
  editorConfig: PropTypes.object,
  onCommit: PropTypes.func,
  isEditorShow: PropTypes.bool,
  updateTabIndex: PropTypes.func,
};

export default ImageEditor;
