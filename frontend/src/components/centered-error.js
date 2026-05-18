import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

function CenteredError({ className, children }) {
  return (
    <div className={classnames('d-flex align-items-center justify-content-center h-100 w-100 o-hidden seaqa-tip-danger', className)}>
      {children}
    </div>
  );
}

CenteredError.propTypes = {
  className: PropTypes.string,
};

export default CenteredError;
