import React from 'react';
import 'webrtc-adapter';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { Modal } from 'antd-mobile';
import { gettext } from '../../../utils/constants';

const propTypes = {
  changeInputValue: PropTypes.func,
  onShowQrReaderToggle: PropTypes.func
};

class CustomCamera extends React.Component {

  constructor(props) {
    super(props);
    this.codeReader = new BrowserMultiFormatReader();
  }

  componentDidMount() {
    this.loadCameraData();
  }

  loadCameraData = () => {
    this.codeReader.listVideoInputDevices().then((videoInputDevices) => {
      this.codeReader.decodeFromVideoDevice(undefined, 'video', (result, error) => {
        if (!this.scanRef.style.animation) {
          this.scanRef.style.animation = 'scanCode 3s linear infinite';
        }
        if (result) {
          this.props.changeInputValue(result.text);
        }
        // When the error is not caused by failure to find the QR code in the video device
        // Source code link: https://github.com/zxing-js/library/blob/master/docs/examples/multi-camera/index.html
        if (error && !(error instanceof NotFoundException)) {
          // eslint-disable-next-line no-console
          console.error(error);
        }
      });
    }).catch(() => {
      const errMessage = gettext('Failed to turn on camera');
      toaster.danger(errMessage);
    });
  };

  onCloseCamera = () => {
    this.codeReader.reset();
  };

  render() {
    return (
      <Modal
        onClose={this.props.onShowQrReaderToggle}
        transparent
        visible={true}
        className="mobile-custom-camera"
      >
        <div className="custom-scan-container">
          <video
            id="video"
            width="300"
            height="200"
          >
          </video>
          <div className="custom-camera-line" ref={ref => this.scanRef = ref}></div>
        </div>
      </Modal>
    );
  }
}

CustomCamera.propTypes = propTypes;

export default CustomCamera;
