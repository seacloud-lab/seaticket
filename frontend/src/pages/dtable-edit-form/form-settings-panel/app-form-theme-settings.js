import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { DTableRadio } from 'dtable-ui-component';
import {
  FORM_THEME_TYPE,
  FORM_THEME_COLORS,
  FORM_THEME_BACKGROUND_IMAGES
} from '../../../constants/form-constants';

const gettext = window.gettext;
const { mediaUrl } = window.app.config;
const { canUseAdvancedCustomization } = window.shared.pageOptions;

class AppFormThemeSettings extends Component {

  constructor(props) {
    super(props);
    this.state = {
      themeType: props.themeType || FORM_THEME_TYPE.COLOR,
      themeBackgroundColor: props.themeBackgroundColor || 'ED7109',
      themeBackgroundImageURL: props.themeBackgroundImageURL || ''
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const { themeType, themeBackgroundColor, themeBackgroundImageURL } = nextProps;
    if (themeType !== this.state.themeType) {
      this.setState({ themeType });
    }
    if (themeBackgroundColor !== this.state.themeBackgroundColor) {
      this.setState({ themeBackgroundColor });
    }
    if (themeBackgroundImageURL !== this.state.themeBackgroundImageURL) {
      this.setState({ themeBackgroundImageURL });
    }
  }

  onSave = (updated) => {
    this.props.onThemeSettingsChange(updated);
  };

  onChangeThemeType = (themeType) => {
    if (themeType === this.state.themeType) return;
    let update = { themeType };
    if (themeType === FORM_THEME_TYPE.IMAGE) {
      const firstBackgroundImage = FORM_THEME_BACKGROUND_IMAGES[0];
      update = Object.assign({}, update, {
        themeBackgroundImageURL: mediaUrl.endsWith('/') ? mediaUrl + firstBackgroundImage : mediaUrl + '/' + firstBackgroundImage
      });
    }
    this.setState(update, () => {
      this.onSave(update);
    });
  };

  onChangeThemeColor = (themeBackgroundColor) => {
    if (themeBackgroundColor === this.state.themeBackgroundColor) return;
    this.setState({ themeBackgroundColor }, () => {
      this.onSave({ themeBackgroundColor });
    });
  };

  onBackgroundImageClick = (event) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    this.uploadBackgroundImageRef.click();
  };

  onBackgroundImageInputFile = (event) => {
    event.stopPropagation();
  };

  handleBackgroundImageChange = (event) => {
    event.persist();
    const image = event.target.files[0];
    this.props.uploadThemeBackgroundImage(image, () => {
      this.uploadBackgroundImageRef.value = '';
    });
  };

  onChangeThemeBackgroundImage = (themeBackgroundImageURL) => {
    this.setState({ themeBackgroundImageURL }, () => {
      this.onSave({ themeBackgroundImageURL });
    });
  };

  renderSettings = () => {
    const { themeType, themeBackgroundColor, themeBackgroundImageURL } = this.state;
    return (
      <Fragment>
        <div className='app-form-theme-background-setting'>
          <DTableRadio
            isChecked={themeType === FORM_THEME_TYPE.COLOR}
            label={gettext('Use color')}
            name="themeColor"
            onCheckedChange={() => this.onChangeThemeType(FORM_THEME_TYPE.COLOR)}
          />
          {themeType === FORM_THEME_TYPE.COLOR && (
            <div className="app-form-theme-background-color-settings">
              {FORM_THEME_COLORS.map(colorKey => {
                return (
                  <div
                    key={colorKey}
                    className="app-form-theme-background-color-item"
                    style={{ backgroundColor: `#${colorKey}` }}
                    onClick={() => this.onChangeThemeColor(colorKey)}
                  >
                    {themeBackgroundColor === colorKey && (
                      <i className="dtable-font dtable-icon-check-mark"></i>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className='app-form-theme-background-setting'>
          <DTableRadio
            isChecked={themeType === FORM_THEME_TYPE.IMAGE}
            label={gettext('Use cover image')}
            name="themeImage"
            onCheckedChange={() => this.onChangeThemeType(FORM_THEME_TYPE.IMAGE)}
          />
          {themeType === FORM_THEME_TYPE.IMAGE && (
            <div className="app-form-theme-background-color-settings">
              {FORM_THEME_BACKGROUND_IMAGES.map(imageURL => {
                const validImageURL = mediaUrl.endsWith('/') ? mediaUrl + imageURL : mediaUrl + '/' + imageURL;
                return (
                  <div
                    key={imageURL}
                    className="app-form-theme-background-image-item"
                    onClick={() => this.onChangeThemeBackgroundImage(validImageURL)}
                  >
                    <img
                      className="app-form-theme-background-image"
                      src={validImageURL}
                      alt={gettext('Form theme background image')}
                    />
                    {themeBackgroundImageURL === validImageURL && (
                      <div className="app-form-theme-background-image-item-selected">
                        <i className="dtable-font dtable-icon-check-mark dtable-check-icon"></i>
                      </div>
                    )}
                  </div>
                );
              })}
              <div
                className="app-form-theme-background-upload-image"
                onClick={this.onBackgroundImageClick}
              >
                <i className="dtable-font dtable-icon-picture"></i>
                <span>{gettext('Upload custom image')}</span>
                <input
                  type="file"
                  className='form-table-background-upload-image'
                  accept="image/*"
                  ref={ref => this.uploadBackgroundImageRef = ref}
                  onClick={this.onBackgroundImageInputFile}
                  onChange={this.handleBackgroundImageChange}
                />
              </div>
              <div className="app-form-theme-background-image-tip">
                {gettext('Recommend image size: 1600*300px')}
              </div>
            </div>
          )}

        </div>
      </Fragment>
    );
  };

  render() {

    return (
      <div className="setting-body app-form-theme-settings-body">
        {canUseAdvancedCustomization ? this.renderSettings() : (
          <div className="app-form-theme-settings-permission-denied">
            <div className="paid-tip">
              <i className="dtable-font dtable-icon-member-free dtable-font-gold mr-2" />
              <span>{gettext('This feature is an enterprise version feature')}</span>
            </div>
          </div>
        )}
      </div>
    );
  }
}

AppFormThemeSettings.propTypes = {
  themeType: PropTypes.string,
  themeBackgroundColor: PropTypes.string,
  themeBackgroundImageURL: PropTypes.string,
  onThemeSettingsChange: PropTypes.func.isRequired,
  uploadThemeBackgroundImage: PropTypes.func.isRequired,
};

export default AppFormThemeSettings;
