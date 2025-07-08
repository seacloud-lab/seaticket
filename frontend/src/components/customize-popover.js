import React from 'react';
import { Popover } from 'reactstrap';
import PropTypes from 'prop-types';
import isHotkey from 'is-hotkey';

const propTypes = {
  target: PropTypes.string.isRequired,
  className: PropTypes.string,
  innerClassName: PropTypes.string,
  popoverClassName: PropTypes.string,
  children: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  hidePopover: PropTypes.func.isRequired,
  hidePopoverWithEsc: PropTypes.func,
  hideArrow: PropTypes.bool,
  placement: PropTypes.string,
  onEnter: PropTypes.func,
  onInnerClick: PropTypes.func,
  modifiers: PropTypes.object,
};

class CustomizePopover extends React.Component {

  dtablePopoverRef = null;

  componentDidMount() {
    document.addEventListener('click', this.hidePopover, true);
    document.addEventListener('keydown', this.onHotKey);
    window.addEventListener('popstate', this.onHistoryState);
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.hidePopover, true);
    document.removeEventListener('keydown', this.onHotKey);
    window.removeEventListener('popstate', this.onHistoryState);
  }

  onHistoryState = (e) => {
    e.preventDefault();
    this.props.hidePopover(e);
  };

  onHotKey = (e) => {
    if (isHotkey('esc', e)) {
      e.preventDefault();
      this.props.hidePopoverWithEsc();
    } else if (isHotkey('enter', e)) {
      this.props.onEnter && this.props.onEnter(e);
    }
  };

  hidePopover = (e) => {
    if (this.dtablePopoverRef && e && !this.dtablePopoverRef.contains(e.target)) {
      let className = '';
      if (e.target.tagName.toLowerCase() === 'svg') {
        className = e.target.className.baseVal;
      } else {
        className = e.target.className;
      }
      if (className.indexOf('popover') === -1) {
      // handle popover inner is dropdown
        if (this.props.onInnerClick && this.props.onInnerClick(e) === false) {
          return;
        }
        this.props.hidePopover(e);
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }
  };

  onPopoverInsideClick = (e) => {
    e.stopPropagation();
  };

  render() {
    const { target, innerClassName, popoverClassName, hideArrow, placement, modifiers } = this.props;
    return (
      <Popover
        placement={placement}
        isOpen={true}
        target={target}
        fade={false}
        hideArrow={hideArrow}
        innerClassName={innerClassName}
        className={popoverClassName}
        boundariesElement={document.body}
        modifiers={modifiers}
      >
        <div ref={ref => this.dtablePopoverRef = ref} onClick={this.onPopoverInsideClick}>
          {this.props.children}
        </div>
      </Popover>
    );
  }
}

CustomizePopover.defaultProps = {
  hideArrow: true,
  placement: 'bottom-start'
};

CustomizePopover.propTypes = propTypes;

export default CustomizePopover;
