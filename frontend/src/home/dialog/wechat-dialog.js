import React from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import { ModalHeader } from '../../components';
import { mediaUrl } from '../../constants';
import { isWorkWeChat } from '../../utils/wechat-utils';

import '../../../css/wechat-dialog.css';

const propTypes = {
  toggleWechatDialog: PropTypes.func.isRequired
};

class WechatDialog extends React.Component {

  isWorkWeixin = isWorkWeChat(window.navigator.userAgent.toLowerCase());

  toggle = () => {
    this.props.toggleWechatDialog();
  };

  render() {
    return (
      <Modal isOpen={true} toggle={this.toggle} zIndex='1060'>
        <ModalHeader toggle={this.toggle}>
          加入咨询群
        </ModalHeader>
        <ModalBody>
          <div className="wechat-dialog-body">
            <img src={`${mediaUrl}img/wechat-QR-code.png`} width="150" alt="" />
            <div className="wechat-dialog-message">
              <p>扫描二维码</p>
              <p>{`加入 SeaTable ${this.isWorkWeixin ? '企业' : ''}微信咨询群`}</p>
            </div>
          </div>
        </ModalBody>
      </Modal>
    );
  }
}

WechatDialog.propTypes = propTypes;

export default WechatDialog;
