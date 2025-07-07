import React from 'react';
import CustomizeSelect from '../customize-select';
import { gettext, siteRoot } from '../../constants';

const {
  currentLang, langList
} = window.app.pageOptions;

class LanguageSetting extends React.Component {

  onChange = (lang) => {
    // selectedItem: {value: '...', label: '...'}
    location.href = `${siteRoot}i18n/?lang=${lang}`;
  };

  render() {
    const options = langList.map((item) => {
      return {
        value: item.langCode,
        label: item.langName
      };
    });

    return (
      <div className="setting-item" id="lang-setting">
        <h3 className="setting-item-heading">{gettext('Language setting')}</h3>
        <div className="language-selector">
          <CustomizeSelect
            value={options.find(option => option.value === currentLang.langCode)}
            options={options}
            onChange={this.onChange}
            maxWidth={200}
          />
        </div>
      </div>
    );
  }
}

export default LanguageSetting;
