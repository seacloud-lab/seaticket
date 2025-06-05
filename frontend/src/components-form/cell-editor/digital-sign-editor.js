import React from 'react';
import PropTypes from 'prop-types';
import MediaQuery from 'react-responsive';
import { ImagePreviewerLightbox } from 'dtable-ui-component';
import { gettext } from '../../utils/constants';
import DigitalSignItemEditor from '../cell-editor-widgets/digital-sign-editor/digital-sign-item-editor';
import DigitalSignUtils from '../cell-editor-widgets/digital-sign-editor/digital-sign-utils';
import DigitalSignEditorView from '../cell-viewer-mobile/digital-sign-editor-view';
import ImageItem from '../cell-editor-widgets/file-image-edit/image-item';

import '../cell-css/digital-sign-editor.css';

const propTypes = {
  column: PropTypes.object,
  isReadOnly: PropTypes.bool,
  isEditorShow: PropTypes.bool,
  onCommit: PropTypes.func,
  value: PropTypes.object,
  editorConfig: PropTypes.object,
  mode: PropTypes.string,
};

class DigitalSignEditor extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowEditor: false,
      isShowDeleteIcon: false,
      isShowLargeImage: false,
      largeImageIndex: -1,
      value: props.value || {},
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.isEditorShow !== this.props.isEditorShow) {
      this.setState({
        isShowEditor: nextProps.isEditorShow,
      });
    }
  }

  deleteSignImage = () => {
    const { column, onCommit, isReadOnly } = this.props;
    if (isReadOnly) return;
    const deletedValue = { [column.key]: null };
    onCommit(deletedValue);
    this.hideLargeImage();
  };

  hideLargeImage = () => {
    this.setState({
      isShowLargeImage: false,
      largeImageIndex: -1,
    });
  };

  handleMouseEnter = () => {
    if (this.props.isReadOnly) return;
    this.setState({ isShowDeleteIcon: true });
  };

  handlerMouseLeave = () => {
    if (this.props.isReadOnly) return;
    this.setState({ isShowDeleteIcon: false });
  };

  toggleEditor = (e) => {
    e && e.stopPropagation();
    if (this.props.isReadOnly) {
      return;
    }
    this.setState({ isShowEditor: !this.state.isShowEditor });
  };

  onCloseEditor = () => {
    this.setState({ isShowEditor: false });
  };

  onClickSignImage = (e) => {
    if (
      e.target.tagName.toLowerCase() === 'img' ||
      e.target.className === 'signature-image-wrapper'
    ) {
      this.setState({
        isShowLargeImage: true,
        largeImageIndex: 0,
      });
    }
  };

  getSignImageBaseUrl = () => {
    const { value, editorConfig } = this.props;
    const url = DigitalSignUtils.parseUrlFromSign(value);
    return DigitalSignUtils.concatToBaseImageUrl(url, editorConfig);
  };

  getSignThumbnailUrl = () => {
    const { value, editorConfig } = this.props;
    const url = DigitalSignUtils.parseUrlFromSign(value);
    return DigitalSignUtils.concatToThumbnailUrl(url, editorConfig);
  };

  renderSignThumbnail = (signThumbnailImageUrl) => {
    const { isShowDeleteIcon } = this.state;
    if (!signThumbnailImageUrl) return null;
    return (
      <div
        className="signature-image-wrapper"
        id="signature-image"
        onClick={this.onClickSignImage}
        onMouseEnter={this.handleMouseEnter}
        onMouseLeave={this.handlerMouseLeave}
      >
        <ImageItem
          src={signThumbnailImageUrl}
          targetId={'signature-image'}
          showDeleteIcon={isShowDeleteIcon}
          deleteImage={this.deleteSignImage}
          index={0}
          disableTooltip={true}
          name={'digital-signature-image'}
        />
      </div>
    );
  };

  renderLargeImage = (signImageBaseUrl) => {
    const { isShowLargeImage, largeImageIndex } = this.state;
    if (!isShowLargeImage || !signImageBaseUrl) return null;
    return (
      <ImagePreviewerLightbox
        className={'digital-sign-image'}
        readOnly={this.props.isReadOnly}
        imageItems={[signImageBaseUrl]}
        imageIndex={largeImageIndex}
        closeImagePopup={this.hideLargeImage}
        moveToPrevImage={() => {}}
        moveToNextImage={() => {}}
        deleteImage={this.deleteSignImage}
      />
    );
  };

  render() {
    const { isShowEditor } = this.state;
    const signImageBaseUrl = this.getSignImageBaseUrl();
    const signThumbnailImageUrl = this.getSignThumbnailUrl();
    const { isRequired } = this.props;
    return (
      <div
        className="digital-sign-editor-wrapper d-flex flex-column"
        ref={(ref) => (this.editorContainer = ref)}
      >
        {!signThumbnailImageUrl && (
          <div>
            <span className="edit-digital-sign-button"
              onClick={this.toggleEditor}
              tabIndex={0}
              aria-label={isRequired ? `${gettext('Edit signature')}, ${gettext('Required')}` : gettext('Edit signature')}
            >
              {gettext('Edit signature')}
            </span>
          </div>
        )}
        <MediaQuery query="(min-width: 768px)">
          <div className="position-relative">
            {this.renderSignThumbnail(signThumbnailImageUrl)}
            {this.renderLargeImage(signImageBaseUrl)}
          </div>
          {isShowEditor && (
            <DigitalSignItemEditor
              column={this.props.column}
              value={this.props.value}
              deleteSignImage={this.deleteSignImage}
              onCloseEditor={this.onCloseEditor}
              onCommit={this.props.onCommit}
              signImageBaseUrl={signImageBaseUrl}
              editorConfig={this.props.editorConfig}
              mode={this.props.mode}
            />
          )}
        </MediaQuery>
        <MediaQuery query="(max-width: 767.8px)">
          {isShowEditor && (
            <DigitalSignEditorView
              column={this.props.column}
              value={this.props.value}
              readOnly={this.props.isReadOnly}
              closeEditor={this.onCloseEditor}
              onCommit={this.props.onCommit}
              signImageBaseUrl={signImageBaseUrl}
              editorConfig={this.props.editorConfig}
            />
          )}
          {this.renderSignThumbnail(signThumbnailImageUrl)}
          {this.renderLargeImage(signImageBaseUrl)}
        </MediaQuery>
      </div>
    );
  }
}

DigitalSignEditor.propTypes = propTypes;

export default DigitalSignEditor;
