import React from 'react';
import PropTypes from 'prop-types';
import SignatureTool from './signature-tool';
import { gettext } from '../../../utils/constants';

const Z_INDEX_SIGN_IMAGE = 2; // higher than the signature canvas

const propTypes = {
  onClickSignImage: PropTypes.func,
  signImageUrl: PropTypes.string,
};

class SignatureBoard extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      startEdit: false,
      isEmpty: !props.signImageUrl,
      signImageUrl: props.signImageUrl,
    };
    this.hasChanged = false;
  }

  componentDidMount() {
    this.initSignTool();
  }

  initSignTool = () => {
    let signatureBoardCanvas = document.querySelector('#signature_board_canvas');
    if (!signatureBoardCanvas || !this.signatureBoard) return;
    signatureBoardCanvas.style.width = `${this.signatureBoard.offsetWidth}px`;
    signatureBoardCanvas.style.height = `${this.signatureBoard.offsetHeight}px`;
    this.signatureTool = new SignatureTool(signatureBoardCanvas, {
      minLineWidth: 2,
      maxLineWidth: 4,
      onStart: this.onStartSign,
    });
  };

  clear = () => {
    this.hasChanged = true;
    this.signatureTool.clear();
    this.setState({ isEmpty: true, signImageUrl: null });
  };

  convert2BlobPNG = (callback) => {
    if (this.signatureTool.isEmpty()) {
      callback && callback(null);
      return;
    }
    this.signatureTool.convert2BlobPNG(callback);
  };

  onStartSign = () => {
    this.hasChanged = true;
    this.setState({ isEmpty: false, signImageUrl: null });
  };

  onClickSignImage = () => {
    if (this.props.onClickSignImage) {
      this.props.onClickSignImage();
    }
  };

  renderTips = () => {
    const { isEmpty } = this.state;
    if (!isEmpty) return null;
    return (
      <div className="signature-board-tips">
        {gettext('Please sign on this panel')}
      </div>
    );
  };

  renderSignImage = () => {
    const { isEmpty, signImageUrl } = this.state;
    if (isEmpty || !signImageUrl) return null;
    let img = new Image();
    img.src = signImageUrl;
    return (
      <div
        className="signature-board-image-wrapper"
        style={{ zIndex: Z_INDEX_SIGN_IMAGE }}
        onClick={this.onClickSignImage}
      >
        <img src={signImageUrl} alt='' draggable={false} />
      </div>
    );
  };

  render() {
    return (
      <div className="signature-board" ref={ref => this.signatureBoard = ref}>
        <div className="canvas-container">
          <canvas id="signature_board_canvas" />
          {this.renderTips()}
        </div>
        {this.renderSignImage()}
      </div>
    );
  }
}

SignatureBoard.propTypes = propTypes;

export default SignatureBoard;
