import React from 'react';
import PropTypes from 'prop-types';
import { QRCodeCanvas } from 'qrcode.react';
import copy from 'copy-to-clipboard';
import html2canvas from 'html2canvas';
import { Toast } from 'antd-mobile';
import { Button, Modal, ModalBody } from 'reactstrap';
import { toaster, DTableModalHeader } from 'dtable-ui-component';
import { Utils } from '../../../utils/utils';

import '../css/share-dialog-qr-code.css';

const gettext = window.gettext;

const propTypes = {
  shareCancel: PropTypes.func.isRequired,
  link: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  icon: PropTypes.object.isRequired,
  qrText: PropTypes.string.isRequired,
  linkText: PropTypes.string,
};

class ShareDialogQRCode extends React.Component {

  constructor(props) {
    super(props);
    this.isDesktop = Utils.isDesktop();
  }

  toggle = () => {
    this.props.shareCancel();
  };

  onCopy = () => {
    const { link, linkText } = this.props;
    const text = linkText ? `${link}\n${linkText}` : link;
    copy(text);
    let message = gettext('The share link has been copied');
    if (this.isDesktop) {
      toaster.success(message);
    } else {
      Toast.show(message, 2);
    }
  };

  onCopyLink = () => {
    copy(this.props.link);
    let message = gettext('The share link has been copied');
    toaster.success(message);
  };

  onSaveToImage = () => {
    html2canvas(document.querySelector('#share-qrcode')).then(canvas => {
      let a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = this.props.qrText;
      a.click();
    });
  };

  render() {
    let { link, name, icon, qrText, linkText } = this.props;
    if (!this.isDesktop) {
      return (
        <Modal isOpen={true} toggle={this.toggle} className="share-dialog-with-qr-code">
          <DTableModalHeader toggle={this.toggle}>
            {icon}<span className="pl-2 text-truncate">{name}</span>
          </DTableModalHeader>
          <ModalBody className="w-100 p-0">
            <div className="share-qrcode text-center" id="share-qrcode">
              <div className="share-qrcode-content">
                <QRCodeCanvas value={link} size={180}/>
              </div>
              <div className="share-qrcode-qrtext mt-4">{qrText}</div>
              <div className="share-qrcode-name mt-1 mb-4">{name}</div>
            </div>
            <div className="mx-4">
              <Button color="primary" onClick={this.onCopy} outline={true} className="w-100 mt-4 btn btn-primary">{gettext('Copy link')}</Button>
            </div>
            <div className="mx-4 mb-6">
              <Button color="primary" onClick={this.onSaveToImage} className="w-100 mt-4 btn btn-primary">{gettext('Save to image')}</Button>
            </div>
          </ModalBody>
        </Modal>
      );
    }
    return (
      <Modal isOpen={true} toggle={this.toggle} className="share-dialog-with-qr-code">
        <DTableModalHeader toggle={this.toggle}>{gettext('Share')}</DTableModalHeader>
        <ModalBody className="d-flex flex-row w-100 p-0">
          <div className="share-item">
            <div className="share-item-inner">
              {icon}
              <span className="pl-2 text-truncate">{name}</span>
            </div>
            <div className="share-copy-link">
              <a className="share-link-text text-truncate" href={link}>{link}</a>
              <span className="share-link-text text-truncate">{linkText}</span>
            </div>
            <Button color="primary" onClick={this.onCopyLink} outline={true} className="mt-4 mb-6" title={gettext('Copy link only')}>
              {gettext('Copy link only')}
            </Button>
            <Button color="primary" onClick={this.onCopy} className="mt-4 mb-6 ml-4" title={gettext('Copy')}>
              {gettext('Copy')}
            </Button>
          </div>
          <div className="share-qrcode text-center">
            <div className="share-qrcode-content">
              <QRCodeCanvas value={link} size={80} />
            </div>
            <div className="seatable-tip-default mt-2">{qrText + ' ' + name}</div>
          </div>
        </ModalBody>
      </Modal>
    );
  }
}

ShareDialogQRCode.propTypes = propTypes;

export default ShareDialogQRCode;
