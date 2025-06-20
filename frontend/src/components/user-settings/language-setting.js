import React from 'react';
import { DTableSelect } from 'dtable-ui-component';
import { gettext, siteRoot } from '../../constants';

const {
  currentLang, langList
} = window.app.pageOptions;

class LanguageSetting extends React.Component {

  onSelectChange = (selectedItem) => {
    // selectedItem: {value: '...', label: '...'}
    location.href = `${siteRoot}i18n/?lang=${selectedItem.value}`;
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
          <DTableSelect
            value={options.find(option => option.value === currentLang.langCode)}
            options={options}
            onChange={this.onSelectChange}
            maxWidth={200}
          />
        </div>
      </div>
    );
  }
}

export default LanguageSetting;
