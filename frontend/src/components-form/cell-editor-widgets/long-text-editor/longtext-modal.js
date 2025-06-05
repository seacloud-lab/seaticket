import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

const propTypes = {
  children: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  onModalClick: PropTypes.func,
};

class LongTextModal extends React.Component {

  constructor(props) {
    super(props);
    this.el = document.createElement('div');
    this.el.className='dtable-web-longtext-modal';
    document.body.appendChild(this.el);
  }

  componentDidMount() {
    this.el.addEventListener('click', this.onModalClick);
  }

  componentWillUnmount() {
    this.el.removeEventListener('click', this.onModalClick);
    document.body.removeChild(this.el);
  }

  onModalClick = (e) => {
    if (this.props.onModalClick && e.target.className === 'dtable-web-longtext-modal') {
      this.props.onModalClick();
    }
  };

  render() {
    return ReactDOM.createPortal(
      this.props.children,
      this.el,
    );
  }
}

LongTextModal.propTypes = propTypes;

export default LongTextModal;
