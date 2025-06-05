import React from 'react';
import PropTypes from 'prop-types';
import './index.css';

class VerticalScrollbar extends React.Component {

  isSelfScroll = true;

  setScrollTop = (scrollTop) => {
    this.isSelfScroll = false;
    this.container.scrollTop = scrollTop;
  };

  onScroll = (event) => {
    event.stopPropagation();
    if (this.isSelfScroll) {
      this.props.onScrollbarScroll(event.target.scrollTop);
      return;
    }
    this.isSelfScroll = true;
  };

  render() {
    const { containerHeight, contentHeight } = this.props;
    if (!containerHeight) return null;
    return (
      <div
        className="vertical-scrollbar"
        style={{ height: containerHeight, right: this.props.getVerticalScrollbarRight() }}
        ref={ref => this.container = ref}
        onScroll={this.onScroll}
      >
        <div className="vertical-scrollbar-inner" style={{ height: contentHeight }}></div>
      </div>
    );
  }
}

VerticalScrollbar.propTypes = {
  containerHeight: PropTypes.number,
  contentHeight: PropTypes.number,
  onScrollbarScroll: PropTypes.func.isRequired,
  getVerticalScrollbarRight: PropTypes.func,
};

export default VerticalScrollbar;
