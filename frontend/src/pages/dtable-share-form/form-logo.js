import React from 'react';
import PropTypes from 'prop-types';

function FormLogo(props) {
  const { name, url, isMobile } = props;
  if (url) {
    return (
      <div className={`${isMobile ? 'mobile-' : ''}form-table-logo`}>
        <img src={url} alt="logo"/>
        <h3 className="form-header-title">{name}</h3>
      </div>
    );
  }
  return <h3 className="form-header-title">{name}</h3>;
}

FormLogo.propTypes = {
  name: PropTypes.string,
  url: PropTypes.string,
  isMobile: PropTypes.bool,
};

export default FormLogo;
