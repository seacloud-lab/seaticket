import React from 'react';
import PropTypes from 'prop-types';

const gettext = window.gettext;

function FormPoweredMobile(props) {
  const { isHidePoweredBy, customPoweredBy, isPro, className } = props;
  const newClassName = `seatable-form-powered ${className || ''}`;
  if (isHidePoweredBy) {
    return <span className={newClassName}></span>;
  }
  const isCustomPoweredBy = !!(isPro && customPoweredBy);
  if (isCustomPoweredBy) {
    return <span className={newClassName}><span dangerouslySetInnerHTML={{ __html: customPoweredBy }}></span></span>;
  }
  return <span className={newClassName}>{gettext('Powered by SeaTable')}</span>;
}

FormPoweredMobile.propTypes = {
  isHidePoweredBy: PropTypes.bool,
  isPro: PropTypes.bool,
  customPoweredBy: PropTypes.string,
  className: PropTypes.string,
};

export default FormPoweredMobile;
