import React from 'react';
import PropTypes from 'prop-types';
import Loading from './loading';
import { gettext } from '../utils/constants';

const propTypes = {
  marginTop: PropTypes.string,
  isLoadingMore: PropTypes.bool,
  onLoadMore: PropTypes.func,
};

class LoadMore extends React.Component {

  render() {
    let { isLoadingMore, onLoadMore, marginTop } = this.props;
    return (
      <div className="load-more-module" style={{ marginTop: marginTop }}>
        {!isLoadingMore && <span onClick={onLoadMore} className="load-more-text">{gettext('Load more')}</span>}
        {isLoadingMore && <Loading />}
      </div>
    );
  }
}

LoadMore.propTypes = propTypes;

export default LoadMore;
