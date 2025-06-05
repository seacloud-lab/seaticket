import React from 'react';
import PropTypes from 'prop-types';
import { Modal } from 'antd-mobile';

const propTypes = {
  closeModal: PropTypes.func.isRequired,
  children: PropTypes.element.isRequired,
};

class MobileModal extends React.PureComponent {

  constructor(props) {
    super(props);
  }

  componentDidMount() {
    history.pushState(null, null, '#');
    window.addEventListener('popstate', this.handleHistoryBack, false);
  }

  componentWillUnmount() {
    window.removeEventListener('popstate', this.handleHistoryBack, false);
  }

  handleHistoryBack = (e) => {
    e.preventDefault();
    this.props.closeModal();
  };

  render() {
    return (
      <Modal
        popup
        visible={true}
        onClose={this.props.closeModal}
        animationType="slide-up"
        transitionName="transitionName"
        maskTransitionName="maskTransitionName"
      >
        {this.props.children}
      </Modal>
    );
  }
}

MobileModal.propTypes = propTypes;

export default MobileModal;
