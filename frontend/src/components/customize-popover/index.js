import React from 'react';
import { Popover } from 'reactstrap';
import PropTypes from 'prop-types';
import { getEventClassName, Utils } from '../../utils/utils';

class CustomizePopover extends React.Component {

  popoverRef = null;

  componentDidMount() {
    document.addEventListener('mousedown', this.onMousedown);
    document.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('popstate', this.onHistoryState);
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.onMousedown);
    document.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('popstate', this.onHistoryState);
  }

  onHistoryState = (e) => {
    e.preventDefault();
    this.props.hidePopover(e);
  };

  onKeyDown = (e) => {
    const { canHidePopover, hidePopoverWithEsc } = this.props;
    if (e.keyCode === Utils.keyCodes.esc && typeof hidePopoverWithEsc === 'function') {
      e.preventDefault();
      hidePopoverWithEsc();
    } else if (e.keyCode === Utils.keyCodes.enter) {
      this.props.onEnter && this.props.onEnter(e);
      // Resolve the default behavior of the enter key when entering formulas is blocked
      if (canHidePopover) return;
      e.stopImmediatePropagation();
    }
  };

  onMousedown = (e) => {
    const { canHidePopover } = this.props;
    if (!canHidePopover) return;
    if (this.popoverRef && e && getEventClassName(e).indexOf('popover') === -1 && !this.popoverRef.contains(e.target)) {
      this.props.hidePopover(e);
    }
  };

  onPopoverInsideClick = (e) => {
    e.stopPropagation();
  };

  render() {
    const { target, innerClassName, popoverClassName, hideArrow, modifiers, placement } = this.props;
    return (
      <Popover
        placement={placement}
        isOpen={true}
        target={target}
        fade={false}
        hideArrow={hideArrow}
        innerClassName={innerClassName}
        className={popoverClassName}
        modifiers={modifiers}
      >
        <div ref={ref => this.popoverRef = ref} onClick={this.onPopoverInsideClick}>
          {this.props.children}
        </div>
      </Popover>
    );
  }
}

CustomizePopover.propTypes = {
  target: PropTypes.any.isRequired,
  innerClassName: PropTypes.string,
  popoverClassName: PropTypes.string,
  children: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  hidePopover: PropTypes.func.isRequired,
  hidePopoverWithEsc: PropTypes.func,
  hideArrow: PropTypes.bool,
  canHidePopover: PropTypes.bool,
  placement: PropTypes.string,
  modifiers: PropTypes.object
};

CustomizePopover.defaultProps = {
  placement: 'bottom-start',
  hideArrow: true,
  canHidePopover: true
};

export default CustomizePopover;
