import React from 'react';
import PropTypes from 'prop-types';
import { ImagePreviewerLightbox } from 'dtable-ui-component';
import { dtableWebAPI } from '../../api/dtable-web-api';
import { getFileIconUrl, imageNameFilter } from '../utils/utils';
import ImageItem from '../cell-editor-widgets/file-image-edit/image-item';
import LocalImageAddition from '../cell-editor-widgets/file-image-edit/local-image-addition';
import MobileLocalImageAddition from '../cell-editor-widgets/file-image-edit/mobile-local-image-addition';
import { Utils } from '../../utils/utils';

import '../cell-css/image-editor.css';

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

class ImageEditor extends React.Component {

  static defaultProps = {
    isReadOnly: false,
    isSubmitting: false,
    value: []
  };

  constructor(props) {
    super(props);
    this.state = {
      newValue: props.value,
      isUpdated: false,
      isUploading: false,
      thumbnailSrcObj: {},
      uploadPercentObj: {},
      enterImageIndex: -1,
    };
    const offsetWidth = document.body.offsetWidth;
    this.containerSize = offsetWidth < 767.8 ? ((offsetWidth - 60 ) / 3) + 'px' : null;
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
    let { column } = this.props;
    let { newValue, enterImageIndex } = this.state;

    if (Array.isArray(newValue) && newValue.length > 0) {
      newValue.forEach((imageItem, index) => {
        let name = decodeURI(imageItem.slice(imageItem.lastIndexOf('/') + 1));
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
              showDeleteIcon={enterImageIndex === index}
              deleteImage={this.deleteImage}
              index={index}
            />
          </div>
        );
      });
    }
    return fileArr;
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
      let { column, onCommit } = this.props;
      let updated = { [column.key]: value };
      onCommit(updated);
    });
  };

  handleImagesChange = (files) => {
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
      dtableWebAPI.getUploadLinkViaFormToken(token, 'image').then((res) => {
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

  getImageUrl(parentPath, fileName) {
    const { server, workspaceID } = config;
    return server + '/workspace/' + workspaceID + parentPath + '/' + encodeURIComponent(fileName);
  }

  onUploadProgress = (event, name) => {
    let { loaded, total } = event;
    let uploadPercent = Math.floor(loaded / total * 100);
    const uploadPercentObj = { ...this.state.uploadPercentObj };
    uploadPercentObj[name] = uploadPercent;
    this.setState({ uploadPercentObj });
  };

  render() {
    const { column, isRequired } = this.props;
    let { newValue, uploadPercentObj, isUploading, thumbnailSrcObj } = this.state;
    let value = this.getFormatValue();
    const isDesktop = Utils.isDesktop();
    return (
      <div className="cell-editor grid-cell-type-image">
        <div className="form-image-container">
          {isDesktop ?
            <LocalImageAddition
              handleImagesChange={this.handleImagesChange}
              value={newValue}
              uploadPercentObj={uploadPercentObj}
              isUploading={isUploading}
              deleteImage={this.deleteImage}
              thumbnailSrcObj={thumbnailSrcObj}
              config={config}
              column={column}
              isReadOnly={this.props.isReadOnly}
              isEditorShow={this.props.isEditorShow}
              isSubmitting={this.props.isSubmitting}
              isRequired={isRequired}
            />
            :
            <MobileLocalImageAddition
              handleImagesChange={this.handleImagesChange}
              value={newValue}
              uploadPercentObj={uploadPercentObj}
              isUploading={isUploading}
              deleteImage={this.deleteImage}
              thumbnailSrcObj={thumbnailSrcObj}
              config={config}
              isReadOnly={this.props.isReadOnly}
              isSubmitting={this.props.isSubmitting}
            />
          }
          {value}
        </div>
        {this.state.isShowLargeImage &&
          <ImagePreviewerLightbox
            readOnly={false}
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

ImageEditor.propTypes = FileEditorPropTypes;

export default ImageEditor;
