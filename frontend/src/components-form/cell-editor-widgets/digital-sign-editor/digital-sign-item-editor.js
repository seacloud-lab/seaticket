import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { toaster, DTableCustomFooter } from 'dtable-ui-component';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import { gettext } from '../../../utils/constants';
import { Utils } from '../../../utils/utils';
import DigitalService from './digital-sign-service';
import SignatureBoard from './signature-board';

const propTypes = {
  column: PropTypes.object,
  editorConfig: PropTypes.object,
  onCloseEditor: PropTypes.func,
  onCommit: PropTypes.func,
  signImageBaseUrl: PropTypes.string,
  value: PropTypes.object,
  mode: PropTypes.string,
};

class DigitalSignItemEditor extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      editorPosition: {},
      saving: false,
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
    document.addEventListener('mousedown', this.hideEditor);
    this.calculatePosition();
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.hideEditor);
  }

  hideEditor = (event) => {
    if (this.editor && event && !this.editor.contains(event.target)) {
      this.props.onCloseEditor();
    }
  };

  calculatePosition = () => {
    if (!this.editor) return;
    const { offsetLeft } = this.editor.parentNode;
    const { offsetWidth: editorWidth, offsetHeight: editorHeight } = this.editor;
    let editorLeft = offsetLeft - editorWidth;
    let editorTop = this.editor.parentNode.getBoundingClientRect().y;
    const { innerHeight } = window;
    if (this.props.mode === 'row_expand') {
      editorTop = editorHeight + editorTop > innerHeight ? innerHeight - editorHeight - 30 : editorTop;
      editorLeft = 90;
    } else {
      editorTop = editorHeight + editorTop > innerHeight ? innerHeight - editorHeight - 10 : editorTop;
      editorLeft = this.editor.parentNode.getBoundingClientRect().x;
    }
    this.setState({
      editorPosition: {
        top: editorTop, left: editorLeft,
      }
    });
  };

  clearSignature = () => {
    this.signatureBoard.clear();
  };

  saveSignature = () => {
    if (!this.signatureBoard || this.state.saving) return;
    if (!this.signatureBoard.hasChanged) {
      this.props.onCloseEditor();
      return;
    }
    this.signatureBoard.convert2BlobPNG((signBlob) => {

      if (!signBlob) {
        if (!this.props.value) {
          this.props.onCloseEditor();
          return;
        }

        // clear the old digital-sign
        this.value = null;
        this.props.onCommit({
          [this.props.column.key]: this.value,
        });
        this.props.onCloseEditor();
        return;
      }
      this.setState({ saving: true });
      this.digitalService.uploadSignImage(signBlob, {
        successCallback: (signature) => {
          this.value = signature;
          this.setState({ saving: false }, () => {
            this.props.onCommit({
              [this.props.column.key]: Object.assign({}, this.value)
            });
            this.props.onCloseEditor();
          });
        },
        failedCallback: (error) => {
          const errMsg = Utils.getErrorMsg(error, true);
          if (!error.response || error.response.status !== 403) {
            toaster.danger(gettext(errMsg));
          }
          this.setState({ saving: false });
        },
      });
    });
  };

  render() {
    const { editorPosition, saving } = this.state;
    const { signImageBaseUrl } = this.props;

    return (
      <div className="digital-sign-editor-container" ref={ref => this.editor = ref} style={{ ...editorPosition }}>
        <div className="digital-sign-editor-header">
          <div className="digital-sign-editor-logo">
            <i className='dtable-font dtable-icon-handwritten-signature'></i>
            <span className='ml-2 digital-sign-editor-title'>{gettext('Digital signature')}</span>
          </div>
          <div className="digital-sign-editor-operations">
            <div className="btn-clear-digital-sign" onClick={this.clearSignature}>
              <i className='dtable-font dtable-icon-clear-format'></i>
              <span>{gettext('Re-sign')}</span>
            </div>
          </div>
        </div>
        <div className="digital-sign-panel">
          <SignatureBoard
            ref={ref => this.signatureBoard = ref}
            signImageUrl={signImageBaseUrl}
          />
        </div>
        <DTableCustomFooter>
          <Button onClick={this.props.onCloseEditor} color='secondary'>
            {gettext('Cancel')}
          </Button>
          <Button onClick={this.saveSignature} color='primary' disabled={saving}>
            {gettext(saving ? 'Saving' : 'Save')}
          </Button>
        </DTableCustomFooter>
      </div>
    );
  }
}

DigitalSignItemEditor.propTypes = propTypes;

export default DigitalSignItemEditor;
