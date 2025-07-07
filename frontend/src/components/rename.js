import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import toaster from './toaster';
import { validateName } from '../utils/utils';

const propTypes = {
  className: PropTypes.string,
  name: PropTypes.string.isRequired,
  onRenameConfirm: PropTypes.func.isRequired,
  onRenameCancel: PropTypes.func.isRequired,
};

class Rename extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      name: props.name
    };
    this.inputRef = React.createRef();
  }

  componentDidMount() {
    this.inputRef.current.focus();
    // ensure real dom has been rendered, then listen the click event
    setTimeout(() => {
      document.addEventListener('mousedown', this.onMouseDown);
    }, 1);
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.onMouseDown);
  }

  onMouseDown = (e) => {
    if (!this.inputRef.current.contains(e.target)) {
      this.onRenameConfirm();
    }
  };

  onChange = (e) => {
    this.setState({ name: e.target.value });
  };

  onClick = (e) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };

  onKeyDown = (e) => {
    if (e.key === 'Enter') {
      this.onRenameConfirm(e);
    }
  };

  onRenameConfirm = (e) => {
    e && e.nativeEvent.stopImmediatePropagation();
    let { isValid, message } = validateName(this.state.name);
    if (!isValid) {
      toaster.danger(message);
      this.props.onRenameCancel();
    }
    else if (message === this.props.name) {
      this.props.onRenameCancel();
    }
    else {
      this.props.onRenameConfirm(message);
    }
  };

  onRenameCancel = (e) => {
    e.nativeEvent.stopImmediatePropagation();
    this.props.onRenameCancel();
  };

  render() {
    const { className } = this.props;
    return (
      <div className={classnames('rename-container', { [className]: className })} onClick={this.onClick}>
        <input
          ref={this.inputRef}
          value={this.state.name}
          onChange={this.onChange}
          onKeyDown={this.onKeyDown}
          onClick={this.onClick}
        />
      </div>
    );
  }
}

Rename.propTypes = propTypes;

export default Rename;
