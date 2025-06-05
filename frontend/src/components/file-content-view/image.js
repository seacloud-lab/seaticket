import React from 'react';
import PropTypes from 'prop-types';
import { Utils } from '../../utils/utils';
import { gettext, siteRoot } from '../../utils/constants';

import '../../css/image-file-view.css';

const propTypes = {
  tip: PropTypes.element,
  canUseThumbnail: PropTypes.bool,
};

const {
  repoID, repoEncrypted,
  fileExt, filePath, fileName,
  thumbnailSizeForOriginal,
  previousImage, nextImage, rawPath,
  xmindImageSrc // for xmind file
} = window.app.pageOptions;

let previousImageUrl; let nextImageUrl;
if (previousImage) {
  previousImageUrl = `${siteRoot}lib/${repoID}/file${Utils.encodePath(previousImage)}`;
}
if (nextImage) {
  nextImageUrl = `${siteRoot}lib/${repoID}/file${Utils.encodePath(nextImage)}`;
}

const FILE_VIEW_CONTENT_PADDING_WIDTH = 60;
const IMAGE_PADDING_WIDTH = 4;

class FileContent extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      loadFailed: false
    };
  }

  componentDidMount() {
    document.addEventListener('keydown', (e) => {
      if (previousImage && e.keyCode === 37) { // press '<-'
        location.href = previousImageUrl;
      }
      if (nextImage && e.keyCode === 39) { // press '->'
        location.href = nextImageUrl;
      }
    });
    this.onRestoreAuto();
  }

  handleLoadFailure = () => {
    this.setState({
      loadFailed: true
    });
  };

  onImageZoomIn = () => {
    let imageWidth = this.imageRef.width;
    let imageHeight = this.imageRef.height;
    this.imageRef.style.maxWidth = imageWidth * 1.1 + IMAGE_PADDING_WIDTH + 'px';
    this.imageRef.style.maxHeight = imageHeight * 1.1 + IMAGE_PADDING_WIDTH + 'px';
  };

  onImageZoomOut = () => {
    let imageWidth = this.imageRef.width;
    let imageHeight = this.imageRef.height;
    this.imageRef.style.maxWidth = imageWidth * 0.9 + IMAGE_PADDING_WIDTH + 'px';
    this.imageRef.style.maxHeight = imageHeight * 0.9 + IMAGE_PADDING_WIDTH + 'px';
  };

  onRestoreAuto = () => {
    const { height, width } = this.fileViewContentRef.getBoundingClientRect();
    this.imageRef.style.maxWidth = width - FILE_VIEW_CONTENT_PADDING_WIDTH + 'px';
    this.imageRef.style.maxHeight = height - FILE_VIEW_CONTENT_PADDING_WIDTH + 'px';
  };

  render() {
    if (this.state.loadFailed) {
      return this.props.tip;
    }

    // request thumbnails for some files
    // only for 'file view'. not for 'history/trash file view'
    let thumbnailURL = '';
    const fileExtList = ['tif', 'tiff', 'psd'];
    if (this.props.canUseThumbnail && !repoEncrypted && fileExtList.includes(fileExt)) {
      thumbnailURL = `${siteRoot}thumbnail/${repoID}/${thumbnailSizeForOriginal}${Utils.encodePath(filePath)}`;
    }

    // for xmind file
    const xmindSrc = xmindImageSrc ? `${siteRoot}${xmindImageSrc}` : '';

    return (
      <div className="file-view-content image-file-view p-0" ref={ref => this.fileViewContentRef = ref}>
        {previousImage && (
          <a href={previousImageUrl} id="img-prev" title={gettext('you can also press ← ')}>
            <span className="dtable-font dtable-icon-left"></span>
          </a>
        )}
        {nextImage && (
          <a href={nextImageUrl} id="img-next" title={gettext('you can also press →')}>
            <span className="dtable-font dtable-icon-right"></span>
          </a>
        )}
        <img className="m-auto" ref={ref => this.imageRef = ref} src={xmindSrc || thumbnailURL || rawPath} alt={fileName} id="image-view" onError={this.handleLoadFailure} />
        <div className="splitToolbarButton d-flex image-zoom-btn-container">
          <span
            title={gettext('Default size')}
            className="rounded image-zoom-item"
            onClick={this.onRestoreAuto}
          >
            <i className="dtable-font dtable-icon-full-screen"></i>
          </span>
          <span
            className="toolbarButton rounded image-zoom-item"
            title={gettext('Zoom in')}
            onClick={this.onImageZoomIn}
          >
            <i className="dtable-font dtable-icon-enlarge1"></i>
          </span>
          <span
            className="toolbarButton  rounded image-zoom-item"
            title={gettext('Zoom out')}
            onClick={this.onImageZoomOut}
          >
            <i className="dtable-font dtable-icon-shrink"></i>
          </span>
        </div>
      </div>
    );
  }
}

FileContent.defaultProps = {
  tip: <div></div>,
  canUseThumbnail: true,
};

FileContent.propTypes = propTypes;

export default FileContent;
