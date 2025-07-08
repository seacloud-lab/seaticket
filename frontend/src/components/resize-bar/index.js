import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { RESIZE_HANDLER_HEIGHT } from './constants';
import { Z_INDEX } from '../../constants';

import './index.css';

class ResizeBar extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowResizeHandler: false,
      drag: null,
    };
  }

  componentWillUnmount() {
    this.cleanUp();
  }

  cleanUp = () => {
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
  };

  onMouseEnter = (evt) => {
    if (!this.state.isShowResizeHandler) {
      this.setState({ isShowResizeHandler: true }, () => {
        this.handleResizeHandlePosition(evt);
        this.sidebarResize.addEventListener('mouseleave', this.onMouseLeave);
      });
    }
  };

  onMouseLeave = () => {
    if (this.state.isShowResizeHandler) {
      this.setState({ isShowResizeHandler: false });
    }
  };

  onMouseDown = (evt) => {
    const drag = this.onDragStart(evt);
    if (evt.preventDefault) {
      evt.preventDefault();
    }

    if (drag === null && evt.button !== 0) {
      return;
    }

    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    this.sidebarResize.removeEventListener('mouseleave', this.onMouseLeave);

    this.setState({ drag });
  };

  onMouseMove = (evt) => {
    if (this.state.drag === null) {
      return;
    }

    if (evt.preventDefault) {
      evt.preventDefault();
    }

    this.onDrag(evt);
  };

  onMouseOver = (evt) => {
    this.handleResizeHandlePosition(evt);
  };

  onMouseUp = (evt) => {
    this.cleanUp();
    this.onDragEnd(evt, this.state.drag);
    this.updateResizeHandleTop(-9999);
    this.setState({ drag: null, isShowResizeHandler: false });
  };

  onDragStart = (evt) => {
    if (evt && evt.dataTransfer && evt.dataTransfer.setData) {
      evt.dataTransfer.setData('text/plain', 'dummy');
    }
  };

  onDrag = (evt) => {
    this.onChangeWidth(evt);
  };

  onDragEnd = (evt) => {
    this.onChangeWidth(evt);
  };

  getWidthFromMouseEvent = (evt) => {
    return evt.pageX || (evt.touches && evt.touches[0] && evt.touches[0].pageX) ||
      (evt.changedTouches && evt.changedTouches[evt.changedTouches.length - 1].pageX);
  };

  handleResizeHandlePosition = (evt) => {
    const { top } = this.sidebarResize.getBoundingClientRect();
    const resizeHandlerTop = evt.pageY - top - RESIZE_HANDLER_HEIGHT / 2;
    this.updateResizeHandleTop(resizeHandlerTop);
  };

  updateResizeHandleTop = (top) => {
    if (!this.resizeHandler || top < 0) return;
    this.resizeHandler.style.top = top + 'px';
  };

  onChangeWidth = (evt) => {
    const { min, max } = this.props;
    const width = this.getWidthFromMouseEvent(evt);
    if (width <= min || width >= max) {
      return;
    }
    this.props.onResize(width);
  };

  render() {
    const { isShowResizeHandler } = this.state;

    return (
      <div
        className="resize-bar"
        ref={ref => this.sidebarResize = ref}
        onMouseDown={this.onMouseDown}
        onMouseOver={this.onMouseOver}
        onMouseEnter={this.onMouseEnter}
        onDrag={this.onDrag}
        onDragStart={this.onDragStart}
        onDragEnd={this.onDragEnd}
        style={{ zIndex: Z_INDEX.RESIZE_BAR }}
      >
        <div className="resize-bar-content">
          {isShowResizeHandler &&
            <div
              className="resize-bar-handler"
              ref={ref => this.resizeHandler = ref}
              style={{ height: RESIZE_HANDLER_HEIGHT }}
            >
            </div>
          }
        </div>
      </div>
    );
  }
}

ResizeBar.propTypes = {
  min: PropTypes.number,
  max: PropTypes.number,
  onResize: PropTypes.func,
};

export default ResizeBar;
