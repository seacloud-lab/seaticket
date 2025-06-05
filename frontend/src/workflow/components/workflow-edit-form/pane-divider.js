import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

const DIVIDER_CLASS = 'grid-pane-divider';
const DIVIDER_HOVER_CLASS = 'grid-pane-divider hover';
const DRAG_HANDLER_HEIGHT = 26;
const SUPPORT_MAX_WIDTH = 500;
const SUPPORT_MIN_WIDTH = 300;

class PaneDivider extends PureComponent {

  constructor(props) {
    super(props);
    this.state = {
      isDragging: false,
      isDragHandlerShow: false
    };
  }

  componentDidMount() {
    this.initDividerOffsets();
  }

  componentWillUnmount() {
    this.cleanUp();
    this.clearTimer();
  }

  initDividerOffsets = () => {
    if (!this.divider) {
      return;
    }
    let workflowWidth = localStorage.getItem('workflow_width');
    workflowWidth = workflowWidth ? workflowWidth : 400;
    this.setDividerLeft(workflowWidth - 2);
  };

  cleanUp = () => {
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
  };

  clearTimer = () => {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  };

  getWidthFromMouseEvent = (evt) => {
    return evt.pageX || (evt.touches && evt.touches[0] && evt.touches[0].pageX) ||
      (evt.changedTouches && evt.changedTouches[evt.changedTouches.length - 1].pageX);
  };

  onMouseEnter = (evt) => {
    this.setDividerTop(0);
    this.handleDragHandlerPosition(evt);
    this.handleHoverDividerClassName();
    this.setState({ isDragHandlerShow: true });
  };

  onMouseLeave = () => {
    this.setDividerTop(0); // init offset top
    this.setDividerClassName(DIVIDER_CLASS); // init className
    this.clearTimer();
    this.setState({ isDragHandlerShow: false });
  };

  onMouseDown = (evt) => {
    if (evt.preventDefault) {
      evt.preventDefault();
    }
    this.setState({ isDragging: true });
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
  };

  onMouseMove = (evt) => {
    if (evt.preventDefault) {
      evt.preventDefault();
    }
    const cursorLeft = this.getWidthFromMouseEvent(evt);
    this.setDividerLeft(cursorLeft - 2);
  };

  onMouseOver = (evt) => {
    this.handleDragHandlerPosition(evt);
  };

  onMouseUp = (evt) => {
    this.cleanUp();
    let cursorLeft = this.getWidthFromMouseEvent(evt);
    if (cursorLeft > SUPPORT_MAX_WIDTH) {
      cursorLeft = SUPPORT_MAX_WIDTH;
    } else if (cursorLeft < SUPPORT_MIN_WIDTH) {
      cursorLeft = SUPPORT_MIN_WIDTH;
    }
    this.props.setWorkflowNodesWidth(cursorLeft - 1);
    this.setDividerLeft(cursorLeft - 2);
  };

  handleDragDivider = (evt) => {
    const cursorLeft = this.getWidthFromMouseEvent(evt);
    this.setDividerLeft(cursorLeft - 1);
  };

  handleHoverDividerClassName = () => {
    if (this.state.isDragging) {
      this.setDividerClassName(DIVIDER_HOVER_CLASS);
      return;
    }

    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.setDividerClassName(DIVIDER_HOVER_CLASS);
        this.clearTimer();
      }, 300);
    }
  };

  handleDragHandlerPosition = (evt) => {
    if (!this.dragHandler) {
      return;
    }
    const { top } = this.divider.getBoundingClientRect();
    const dragHandlerTop = evt.pageY - top - DRAG_HANDLER_HEIGHT / 2;
    if (dragHandlerTop < 50) {
      this.setDragHandlerTop(50);
      return;
    }
    this.setDragHandlerTop(dragHandlerTop);
  };

  setDividerClassName = (className) => {
    this.divider.setAttribute('class', className);
  };

  setDividerLeft = (left) => {
    this.divider.style.left = left + 'px';
  };

  setDividerTop = (top) => {
    this.divider.style.top = top + 'px';
  };

  setDragHandlerTop = (top) => {
    this.dragHandler.style.top = top + 'px';
  };

  setTooltipTop = (top) => {
    this.tooltip.style.top = top + 'px';
  };

  setTooltipLeft = (left) => {
    this.tooltip.style.left = left + 'px';
  };

  render() {
    const dividerStyle = {
      top: 0,
      zIndex: 4,
    };

    return (
      <div
        className={DIVIDER_CLASS}
        ref={ref => this.divider = ref}
        style={dividerStyle}
        onMouseDown={this.onMouseDown}
        onMouseOver={this.onMouseOver}
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
      >
        <div className="line" onMouseOver={this.onMouseOver}></div>
        <div
          className="drag-handler"
          ref={ref => this.dragHandler = ref}
          style={{ height: this.state.isDragHandlerShow ? DRAG_HANDLER_HEIGHT : 0, zIndex: 4 }}
        >
        </div>
      </div>
    );
  }
}

PaneDivider.propTypes = {
  setWorkflowNodesWidth: PropTypes.func.isRequired,
};

export default PaneDivider;
