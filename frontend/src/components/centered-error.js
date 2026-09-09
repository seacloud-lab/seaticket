import React from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';

function CenteredError({ className, children }) {
  return (
    <div className={classnames('d-flex align-items-center justify-content-center h-100 w-100 o-hidden text-danger font-size-13', className)}>
      {children}
    </div>
  );
}

CenteredError.propTypes = {
  className: PropTypes.string,
};

export default CenteredError;
