import React from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import SlideCaptcha from '../slide-captcha';
import ModalHeader from '../modal-header';

import '../../css/slide-captcha-dialog.css';

export default class SlideCaptchaDialog extends React.Component {

  static propTypes = {
    toggle: PropTypes.func.isRequired,
    onSuccess: PropTypes.func.isRequired,
  };

  render() {
    return (
      <Modal isOpen={true} toggle={this.props.toggle} className="slide-captcha-dialog">
        <ModalHeader toggle={this.props.toggle}>{'安全验证'}</ModalHeader>
        <ModalBody>
          <SlideCaptcha onSuccess={this.props.onSuccess}/>
        </ModalBody>
      </Modal>
    );
  }
}
