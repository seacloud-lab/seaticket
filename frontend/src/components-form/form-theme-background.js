import React from 'react';
import PropTypes from 'prop-types';
import { FORM_THEME_TYPE } from '../constants/form-constants';
import { getThemeBackgroundDisplay } from '../utils/form-utils';

function FormThemeBackground(props) {
  const { themeType, themeBackgroundColor, themeBackgroundImageURL } = props;
  const themeBackground = getThemeBackgroundDisplay(themeType, themeBackgroundColor, themeBackgroundImageURL);
  if (themeType === FORM_THEME_TYPE.COLOR) {
    return (
      <div
        className="app-form-theme-background-color-display"
        style={{ backgroundColor: themeBackground }}
      >
      </div>
    );
  }
  return (
    <div
      className="app-form-theme-background-image-display"
      style={{ backgroundImage: `url('${themeBackground}')` }}
    >
    </div>
  );
}

FormThemeBackground.propTypes = {
  themeType: PropTypes.string,
  themeBackgroundColor: PropTypes.string,
  themeBackgroundImageURL: PropTypes.string,
};

export default FormThemeBackground;
