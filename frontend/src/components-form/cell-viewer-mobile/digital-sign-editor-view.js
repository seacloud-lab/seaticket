import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Toast } from 'antd-mobile';
import { toaster, ImagePreviewerLightbox } from 'dtable-ui-component';
import { dtableWebAPI } from '../../api/dtable-web-api';
import { gettext } from '../../utils/constants';
import { Utils } from '../../utils/utils';
import DigitalService from '../cell-editor-widgets/digital-sign-editor/digital-sign-service';
import MobileCommonHeader from './mobile-common-header';
import SignatureBoard from '../cell-editor-widgets/digital-sign-editor/signature-board';
import * as zIndexes from '../utils/zIndexes';

import '../cell-css/mobile/digital-sign-view.css';

const MAX_WIDTH = 600;
const Z_INDEX_PANEL_OPERATIONS = 3; // higher than sign image

const propTypes = {
  readOnly: PropTypes.bool,
  column: PropTypes.object,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  t: PropTypes.func,
  onCommit: PropTypes.func,
  closeEditor: PropTypes.func,
  signImageBaseUrl: PropTypes.string,
  editorConfig: PropTypes.object,
};

class DigitalSignEditorView extends Component {

  constructor(props) {
    super(props);
    this.state = {
      panelOffsets: null,
      isShowLargeImage: false,
    };
    const { workspaceID, fileName, token, taskId, editorIn } = props.editorConfig;
    const { username } = window.app.pageOptions;
    let apiUploadLinkName;
    if (editorIn === 'form') {
      apiUploadLinkName = 'getUploadLinkViaFormToken';
    } else if (editorIn === 'workflow') {
      apiUploadLinkName = 'getUploadLinkViaWorkflowToken';
    }
    this.digitalService = new DigitalService({
      dtableWebAPI,
      workspaceID,
      fileName,
      username,
      token,
      taskId,
      apiUploadLinkName
    });
  }

  componentDidMount() {
    history.pushState(null, null, '#');
    window.addEventListener('popstate', this.handleHistoryBack, false);
    this.init();
    this.html = document.querySelector('html');
    this.html.style.overflow = 'hidden';
  }

  componentWillUnmount() {
    window.removeEventListener('popstate', this.handleHistoryBack, false);
    if (this.html) {
      this.html.style.overflow = 'unset';
    }
  }

  handleHistoryBack = (e) => {
    e.preventDefault();
    this.props.closeEditor();
  };

  init = () => {
    const { innerWidth, innerHeight } = window;
    const headerHeight = 50;
    const spaceHeight = 20 * 2; // top & bottom of panel
    let width = Math.min(innerWidth, MAX_WIDTH);
    let height = width / 2;
    if (height + headerHeight + spaceHeight > innerHeight) {
      height = innerHeight - headerHeight - spaceHeight;
      width = height * 2;
    }
    this.setState({ panelOffsets: { width, height } });
  };

  deleteSignImage = () => {
    const { column } = this.props;
    this.props.onCommit({ [ column.key ]: null }, column);
    this.clearSignature();
    this.hideLargeImage();
  };

  clearSignature = () => {
    this.signatureBoard.clear();
  };

  getPanelStyle = () => {
    return this.state.panelOffsets;
  };

  hideLargeImage = () => {
    this.setState({ isShowLargeImage: false });
  };

  onClickSignImage = () => {
    this.setState({ isShowLargeImage: true });
  };

  onSave = () => {
    if (this.props.readOnly || !this.signatureBoard || this.saving) return;
    if (!this.signatureBoard.hasChanged) {
      this.props.closeEditor();
      return;
    }
    const { column } = this.props;
    const { key: columnKey } = column;
    this.signatureBoard.convert2BlobPNG((signBlob) => {
      if (!signBlob) {
        if (!this.props.value) {
          this.props.closeEditor();
          return;
        }

        this.props.onCommit({ [columnKey]: null }, column);
        this.props.closeEditor();
        return;
      }
      this.saving = true;
      Toast.loading(gettext('Saving'), 0);
      this.digitalService.uploadSignImage(signBlob, {
        successCallback: (signature) => {
          Toast.hide();
          this.saving = false;
          this.props.onCommit({ [columnKey]: signature }, column);
          this.props.closeEditor();
        },
        failedCallback: (error) => {
          const errMsg = Utils.getErrorMsg(error, true);
          if (!error.response || error.response.status !== 403) {
            toaster.danger(gettext(errMsg));
          }
          Toast.hide();
          this.saving = false;
          this.props.closeEditor();
        },
      });
    });
  };

  render() {
    const { column, readOnly, signImageBaseUrl } = this.props;

    return (
      <div
        className="row-expand-view digital-sign-view"
        style={{ zIndex: zIndexes.ROW_EXPAND_VIEW, backgroundColor: '#f5f5f5' }}
      >
        <MobileCommonHeader
          title={column.name}
          onLeftClick={this.props.closeEditor}
          onRightClick={this.onSave}
          leftName={gettext('Cancel')}
          rightName={gettext('Done')}
        />
        <div className="view-partition"></div>
        <div className="digital-sign-view-container">
          <div className="digital-sign-view-panel-wrapper">
            <div
              className="digital-sign-view-panel"
              ref={ref => this.panel = ref}
              style={this.getPanelStyle()}
            >
              {!readOnly && (
                <div className="digital-sign-view-panel-operations" style={{ zIndex: Z_INDEX_PANEL_OPERATIONS }}>
                  <div className="mobile-btn-clear" onClick={this.clearSignature}>{gettext('Re-sign')}</div>
                </div>
              )}
              {this.state.panelOffsets && (
                <SignatureBoard
                  ref={ref => this.signatureBoard = ref}
                  signImageUrl={signImageBaseUrl}
                  onClickSignImage={this.onClickSignImage}
                />
              )}
            </div>
          </div>
        </div>
        <div className="view-partition"></div>
        {this.state.isShowLargeImage && (
          <ImagePreviewerLightbox
            className={'digital-sign-image'}
            readOnly={readOnly}
            imageItems={[signImageBaseUrl]}
            imageIndex={0}
            closeImagePopup={this.hideLargeImage}
            moveToPrevImage={() => {}}
            moveToNextImage={() => {}}
            deleteImage={this.deleteSignImage}
          />
        )}
      </div>
    );
  }
}

DigitalSignEditorView.propTypes = propTypes;

export default DigitalSignEditorView;
