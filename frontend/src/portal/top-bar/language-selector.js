import React, { useCallback, useRef, useState } from 'react';
import classnames from 'classnames';
import { CustomizePopover, Icon, IconButton } from '@/components';
import { gettext, siteRoot } from '@/constants';

import './language-selector.css';

const LanguageSelector = () => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef(null);
  const currentLanguage = window.app.config.lang;
  const languages = Array.isArray(window.app.pageOptions.langList) ? window.app.pageOptions.langList : [];
  const i18nUrl = window.app.pageOptions.i18nUrl || `${siteRoot}i18n/`;

  const toggle = useCallback(() => {
    setIsOpen((open) => !open);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const onButtonKeyDown = useCallback((event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggle();
  }, [toggle]);

  const onLanguageChange = useCallback((langCode) => {
    close();
    if (langCode === currentLanguage) return;
    window.location.href = `${i18nUrl}?lang=${encodeURIComponent(langCode)}`;
  }, [close, currentLanguage, i18nUrl]);

  if (languages.length === 0) return null;

  return (
    <div className="seaqa-portal-language-selector">
      <IconButton
        ref={buttonRef}
        className={classnames('seaqa-portal-language-btn', { active: isOpen })}
        icon="language"
        size={{ btn: 32, icon: 16 }}
        role="button"
        tabIndex={0}
        title={gettext('Language')}
        aria-label={gettext('Language')}
        aria-expanded={isOpen}
        onClick={toggle}
        onKeyDown={onButtonKeyDown}
      />
      {isOpen && (
        <CustomizePopover
          target={buttonRef}
          className="seaqa-portal-language-popover"
          placement="bottom-end"
          hidePopover={close}
          hidePopoverWithEsc={close}
          modifiers={[
            { name: 'preventOverflow', options: { boundary: document.body } },
            { name: 'offset', options: { offset: [0, 8] } },
          ]}
        >
          <div className="seaqa-portal-language-list" role="menu">
            {languages.map((language) => {
              const isSelected = language.langCode === currentLanguage;
              return (
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={isSelected}
                  className={classnames('seaqa-portal-language-item', { selected: isSelected })}
                  key={language.langCode}
                  onClick={() => onLanguageChange(language.langCode)}
                >
                  <span className="text-truncate">{language.langName}</span>
                  {isSelected && <Icon symbol="check-mark" />}
                </button>
              );
            })}
          </div>
        </CustomizePopover>
      )}
    </div>
  );
};

export default LanguageSelector;
