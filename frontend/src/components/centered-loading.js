import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import Loading from './loading';

function CenteredLoading(props) {
  return (
    <div className={classnames('d-flex align-items-center justify-content-center h-100 w-100 o-hidden', props.className)}>
      <Loading />
    </div>
  );
}

CenteredLoading.propTypes = {
  className: PropTypes.string,
};

export default CenteredLoading;
