import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

import './index.css';

const propTypes = {
  scrollLeft: PropTypes.number,
  columns: PropTypes.array,
  setItemScrollLeft: PropTypes.func,
  setScrollLeft: PropTypes.func,
  getCurrentDisplayRowMaxIndex: PropTypes.func,
};

class LinkRecordsListHeader extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      canCardHeaderScroll: true,
      linkRecordsNavScrollWidth: 0,
      linkRecordsNavWidth: 0
    };
  }

  componentDidUpdate(prevProps, prevState) {
    const { offsetWidth, scrollWidth } = this.linkRecordsHeader;
    if (prevState.linkRecordsNavScrollWidth !== scrollWidth
    || prevState.linkRecordsNavWidth !== offsetWidth) {
      this.props.getCurrentDisplayRowMaxIndex();
      this.setState({
        linkRecordsNavScrollWidth: scrollWidth,
        linkRecordsNavWidth: offsetWidth
      });
    }
  }

  onScrollControlClick = (type) => {
    const tablesNav = this.linkRecordsHeader;
    const { offsetWidth, scrollWidth, scrollLeft } = tablesNav;
    let targetScrollLeft;
    if (type === 'prev') {
      if (scrollLeft === 0) {
        return;
      }
      targetScrollLeft = scrollLeft - offsetWidth;
      targetScrollLeft = targetScrollLeft > 0 ? targetScrollLeft : 0;
    }

    if (type === 'next') {
      if (scrollLeft + offsetWidth === scrollWidth) {
        return;
      }
      targetScrollLeft = scrollLeft + offsetWidth;
      targetScrollLeft = targetScrollLeft > scrollWidth - offsetWidth ? scrollWidth - offsetWidth : targetScrollLeft;
    }
    if (this.state.canCardHeaderScroll) {
      this.setState({ canCardHeaderScroll: false });
      let timer = null;
      let step = (targetScrollLeft - scrollLeft) / 10;
      step = step > 0 ? Math.ceil(step) : Math.floor(step);
      timer = setInterval(() => {
        tablesNav.scrollLeft = tablesNav.scrollLeft + step;
        if (Math.abs(targetScrollLeft - tablesNav.scrollLeft) <= Math.abs(step)) {
          tablesNav.scrollLeft = targetScrollLeft;
          clearInterval(timer);
          this.setState({ canCardHeaderScroll: true });
        }
      }, 30);
    }
  };

  onScrollHeader = () => {
    let { scrollLeft } = this.linkRecordsHeader;
    this.props.setItemScrollLeft(scrollLeft, -1);
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.props.setScrollLeft(scrollLeft);
    }, 60);
  };

  setHeaderScrollLeft = (scrollLeft) => {
    this.linkRecordsHeader.scrollLeft = scrollLeft;
  };

  render() {
    const { columns, scrollLeft } = this.props;
    const { linkRecordsNavWidth, linkRecordsNavScrollWidth } = this.state;

    return (
      <div className="row-card-column-names">
        <span
          className={classnames('dtable-font', 'dtable-icon-left', 'row-card-scroll', 'link-scroll-prev', { 'scroll-active': scrollLeft > 0 })}
          onClick={this.onScrollControlClick.bind(this, 'prev')}
        >
        </span>
        <div className="row-card-columns-container" ref={ref => this.linkRecordsHeader = ref} onScroll={this.onScrollHeader}>
          <div className="d-inline-flex">
            {columns.map(column => {
              const { width, name, key } = column;
              return (
                <div
                  className="row-card-column-name text-truncate"
                  style={{ width: width }}
                  key={key}
                  title={name}
                >
                  {name}
                </div>
              );
            })}
          </div>
        </div>
        <span
          className={classnames('dtable-font', 'dtable-icon-right', 'row-card-scroll', 'link-scroll-next', { 'scroll-active': scrollLeft + linkRecordsNavWidth < linkRecordsNavScrollWidth })}
          onClick={this.onScrollControlClick.bind(this, 'next')}
        >
        </span>
      </div>
    );
  }
}

LinkRecordsListHeader.propTypes = propTypes;

export default LinkRecordsListHeader;
