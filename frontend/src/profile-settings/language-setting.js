import React from 'react';
import { LanguageSelect } from '@/components';
import { gettext, siteRoot } from '@/constants';

const { langCode } = window.app.pageOptions;

class LanguageSetting extends React.Component {

  onChange = (lang) => {
    location.href = `${siteRoot}i18n/?lang=${lang}`;
  };

  render() {
    return (
      <div className="setting-item" id="lang-setting">
        <h3 className="setting-item-heading">{gettext('Language setting')}</h3>
        <LanguageSelect value={langCode} onChange={this.onChange} />
      </div>
    );
  }
}

export default LanguageSetting;
