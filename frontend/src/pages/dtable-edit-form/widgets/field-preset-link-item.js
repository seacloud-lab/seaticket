import React, { Component } from 'react';
import PropTypes from 'prop-types';
import copy from 'copy-to-clipboard';
import { Button, Popover, UncontrolledTooltip } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import dayjs from 'dayjs';
import { QRCodeCanvas } from 'qrcode.react';
import Icon from '../../../components/icon';

import '../css/field-preset-link-item.css';

const propTypes = {
  disableButton: PropTypes.bool,
  linkItem: PropTypes.object,
  onDeleteLink: PropTypes.func,
  onSelectLink: PropTypes.func,
  onQrCodePopoverToggle: PropTypes.func,
  index: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

const gettext = window.gettext;

class FieldPresetLinkItem extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowOperation: false,
      showQRCode: false,
    };
    this.formLinkRef = React.createRef();
    this.linkWrapperRef = React.createRef();
    this.qrcodeContainerRef = React.createRef();
  }

  componentDidMount() {
    document.addEventListener('mousedown', this.handleClickOutside);
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClickOutside);
  }

  handleClickOutside = (event) => {
    if (this.linkWrapperRef.current && !this.linkWrapperRef.current.contains(event.target)
    ) {
      this.setState({ showQRCode: false, isShowOperation: false });
    }
  };

  handleQrcodeCopy = async (e) => {
    const container = this.qrcodeContainerRef.current;
    const canvas = container.querySelector('canvas');
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const item = new ClipboardItem({ 'image/png': blob });
    await navigator.clipboard.write([item]);
    toaster.success(gettext('The QR code has been copied'));
  };

  handleQrcodeDownload = async () => {
    const container = this.qrcodeContainerRef.current;
    const canvas = container.querySelector('canvas');
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'QRCode';
    a.click();
  };

  toggleQRCode = () => {
    this.setState({ showQRCode: !this.state.showQRCode });
  };

  onMouseEnter = () => {
    this.setState({ isShowOperation: true });
  };

  onMouseLeave = () => {
    if (this.state.showQRCode) return;
    this.setState({ isShowOperation: false });
  };

  onCopyLink = () => {
    const { linkItem } = this.props;
    copy(linkItem.value);
    let message = gettext('The form custom share link has been copied');
    toaster.success(message);
  };

  deleteLink = () => {
    const { linkItem } = this.props;
    this.props.onDeleteLink(linkItem);
  };

  selectLink = () => {
    const { linkItem } = this.props;
    this.props.onSelectLink(linkItem);
  };

  onToggleQrCode = () => {
    this.setState({ showQRCode: !this.state.showQRCode });
  };

  render() {
    const { isShowOperation } = this.state;
    const { linkItem, disableButton, index } = this.props;
    const { name, value, created_at: createdAt } = linkItem;
    const formattedCreateTime = createdAt && dayjs(createdAt).format('YYYY-MM-DD HH:mm');

    return (
      <tr ref={this.linkWrapperRef} onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave} className="preset-link-item">
        <td className="ellipsis">{name || '--'}</td>
        <td className="link-value ellipsis" ref={this.formLinkRef}>{value || '--'}</td>
        <UncontrolledTooltip placement="bottom" target={this.formLinkRef} modifiers={[{ name: 'preventOverflow', options: { boundary: document.body } }]}>
          {linkItem.value}
        </UncontrolledTooltip>
        <td className="ellipsis">{formattedCreateTime || '--'}</td>
        <td>
          <div className='d-flex justify-content-center align-items-center'>
            {!disableButton && (
              <span
                className={`dtable-font dtable-icon-rename action-icon ${isShowOperation ? '' : 'hide'}`}
                data-placement="bottom"
                onClick={this.selectLink}
                title={gettext('Edit link')}
                aria-label={gettext('Edit link')}
              />
            )}
            <div className='d-flex' id={`form-qrcode-icon-${index}`}>
              <Icon
                symbol="qr-code"
                className={`dtable-font action-icon ${isShowOperation ? '' : 'hide'}`}
                title={gettext('QR code')}
                onClick={this.onToggleQrCode}
              />
            </div>
            <span
              className={`dtable-font dtable-icon-copy-link action-icon ${isShowOperation ? '' : 'hide'}`}
              data-placement="bottom"
              onClick={this.onCopyLink}
              title={gettext('Copy link')}
              aria-label={gettext('Copy link')}
            />
            {!disableButton && (
              <span
                className={`dtable-font dtable-icon-x action-icon ${isShowOperation ? '' : 'hide'}`}
                onClick={this.deleteLink}
                title={gettext('Delete')}
                aria-label={gettext('Delete')}
              />
            )}
            <div className='form-qrcode-popover-wrapper' >
              {this.state.showQRCode && (
                <Popover
                  target={`form-qrcode-icon-${index}`}
                  isOpen={true}
                  fade={true}
                  hideArrow={false}
                  placement="bottom"
                  modifiers={[{ name: 'preventOverflow', options: { boundary: 'viewport' } }]}
                  container={this.linkWrapperRef}
                >
                  <div className='form-qr-code-wrapper'>
                    <div ref={this.qrcodeContainerRef} className='form-qrcode-container'>
                      <QRCodeCanvas value={linkItem.value} size={128} />
                    </div>
                    <Button color="primary" className='qrcode-download-btn' onClick={this.handleQrcodeDownload}>{gettext('Download')}</Button>
                    <Button color="primary" outline={true} className='qrcode-copy-btn' onClick={this.handleQrcodeCopy}>{gettext('Copy')}</Button>
                  </div>
                </Popover>
              )}
            </div>
          </div>
        </td>
      </tr>
    );
  }
}

FieldPresetLinkItem.propTypes = propTypes;

export default FieldPresetLinkItem;
