import React from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import { DTableModalHeader } from 'dtable-ui-component';
import { mediaUrl } from '../../../utils/constants';
import { isWorkWeixin } from '../../../components-form/utils/weixin-utils';

import '../../../css/wechat-dialog.css';

const propTypes = {
  toggleWechatDialog: PropTypes.func.isRequired
};

class WechatDialog extends React.Component {

  isWorkWeixin = isWorkWeixin(window.navigator.userAgent.toLowerCase());

  toggle = () => {
    this.props.toggleWechatDialog();
  };

  render() {
    return (
      <Modal isOpen={true} toggle={this.toggle} zIndex='1060'>
        <DTableModalHeader toggle={this.toggle}>
          加入咨询群
        </DTableModalHeader>
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
