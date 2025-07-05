import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

import './index.css';

function CenteredError({ className, children }) {
  return (
    <div className={classnames('sea-qa-display-center error', className)}>
      {children}
    </div>
  );
}

CenteredError.propTypes = {
  className: PropTypes.string,
};

export default CenteredError;
