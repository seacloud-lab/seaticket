import React from 'react';
import PropTypes from 'prop-types';
import { ActivityIndicator } from 'antd-mobile';
import { gettext } from '../../utils/constants';
import MobileUpload from './mobile-upload';
import MobileCommonHeader from './mobile-common-header';
import ImageListPreviewer from './image-list-previewer';

const { workspaceID, dtableWebURL: server } = window.shared.pageOptions;

const propTypes = {
  value: PropTypes.oneOfType([PropTypes.array, PropTypes.string]),
  column: PropTypes.object,
  onCommit: PropTypes.func,
  closeEditor: PropTypes.func,
  openEditorMode: PropTypes.string,
  uploadLocalFile: PropTypes.func,
};

const PREVIEWER = 'previewer', ADDITION = 'addition';

class ImageEditorView extends React.Component {
  
  constructor(props) {
    super(props);
    this.state = {
      value: props.value || [],
      editorView: props.openEditorMode === 'file_image_addition' || (!props.value || props.value.length === 0) ? ADDITION : PREVIEWER,
      isUploading: false,
      uploadLocalImageValue: [],
    };
  }

  getValue = () => {
    const updated = {};
    updated[this.props.column.key] = this.state.value;
    return updated;
  };

  onCommit = () => {
    this.props.onCommit(this.getValue(), this.props.column);
  };

  deleteImage = (index, type = null) => {
    let uploadLocalImageValue = this.state.uploadLocalImageValue.slice(0);
    let value = this.state.value.slice(0);
    if (this.state.editorView === PREVIEWER) {
      value.splice(index, 1);
    } else if (type === 'localPicture') { 
      uploadLocalImageValue.splice(index, 1);
    }
    this.setState({
      uploadLocalImageValue: uploadLocalImageValue,
      value: value
    }, () => {
      this.onCommit();
    });
  };

  resetAdditionImage = () => {
    this.setState({ uploadLocalImageValue: [] });
  };

  toggle = () => {
    if (this.state.editorView === ADDITION) {
      this.togglePreviewer(PREVIEWER);
    } else {
      this.props.closeEditor();
    }
  };

  togglePreviewer = (type) => {
    if (type === ADDITION && this.state.editorView === ADDITION) {
      this.setState({ editorView: PREVIEWER}, () => {
        this.setState({ editorView: ADDITION });
      });
    } else {
      this.setState({ editorView: type });
    }
  };

  handleFilesChange = (e) => {
    this.setState({ isUploading: true });
    e.persist();
    const files = e.target.files;
    const total = files.length;
    let uploaded = 0;
    for (let i = 0; i < total; i++) {
      this.props.uploadLocalFile(files[i]).then((response) => {
        let uploadLocalImageValue = this.state.uploadLocalImageValue.slice(0);
        uploadLocalImageValue.push(response);
        this.setState({ uploadLocalImageValue });
        this.onUploaded(++uploaded, total);
      });
    }
  };

  onUploaded = (uploaded, total) => {
    if (uploaded === total) {
      let { value, uploadLocalImageValue } = this.state;
      let newValue = value.concat(uploadLocalImageValue);
      this.setState({ value: newValue, isUploading: false }, () => {
        this.onCommit();
      });
      this.togglePreviewer(PREVIEWER);
    }
  };

  render() {
    let { value, editorView, isUploading } = this.state;
    return (
      <div className="row-expand-view image-editor-view" style={{ zIndex: 100 }}>
        <MobileCommonHeader
          title={gettext('All images')}
          onLeftClick={this.toggle}
          leftName={<i className="dtable-font dtable-icon-return"></i>}
        />
        <div className="view-partition view-partition-border-bottom"></div>
        <div className="image-editor-container">
          <ImageListPreviewer
            value={value} 
            togglePreviewer={this.togglePreviewer} 
            deleteImage={this.deleteImage}
            resetAdditionImage={this.resetAdditionImage}
            closeEditor={this.toggle}
          /> 
          {editorView === ADDITION && 
            <MobileUpload
              handleFilesChange={this.handleFilesChange}
              togglePreviewer={this.togglePreviewer}
            />
          }
          {isUploading && <ActivityIndicator toast text={gettext('Images are uploading')} animating={isUploading}/>}
        </div>
      </div>
    );
  }
}

ImageEditorView.propTypes = propTypes;

export default ImageEditorView;
