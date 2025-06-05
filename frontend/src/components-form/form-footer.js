import React from 'react';
import PropTypes from 'prop-types';

const gettext = window.gettext;

function FormFooter(props) {
  const { isHidePoweredBy, customPoweredBy, isPro, className } = props;
  const isCustomPoweredBy = !!(isPro && customPoweredBy);
  const newClassName = `form-footer ${className || ''}`;
  if (isHidePoweredBy) {
    return <div className={newClassName}></div>;
  }
  if (isCustomPoweredBy) {
    return (
      <div className={newClassName}>
        <div dangerouslySetInnerHTML={{ __html: customPoweredBy }}></div>
      </div>
    );
  }
  return <div className={newClassName}>{gettext('Powered by SeaTable')}</div>;
}

FormFooter.propTypes = {
  isHidePoweredBy: PropTypes.bool,
  isPro: PropTypes.bool,
  customPoweredBy: PropTypes.string,
  className: PropTypes.string,
};

export default FormFooter;
