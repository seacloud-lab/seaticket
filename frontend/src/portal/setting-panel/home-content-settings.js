import React, { useCallback } from 'react';
import { Label, Input } from 'reactstrap';
import { CustomizeSelect } from '@/components';
import { gettext } from '@/constants';

import './home-content-settings.css';

const TITLE_SIZE_OPTIONS = [32, 40, 48, 56, 64, 72].map((size) => ({
  value: size,
  name: `${size}px`,
  label: `${size}px`,
}));

const CARD_LAYOUT_OPTIONS = [2, 3, 4, 5, 6].map((count) => ({
  value: count,
  name: count + '',
  label: count + '',
}));

const HomeContentSettings = ({ homePageStyle = {}, setHomePageStyle, updateHomeSetting }) => {
  const heroSection = homePageStyle['portal_home_hero_section'] || {};
  const cardsSection = homePageStyle['portal_home_cards_section'] || {};
  const { title_text = gettext('Hey 👋, how can we help?'), description_text = gettext('Chat with AI'), title_size = 48 } = heroSection;
  const { card_layout = 3 } = cardsSection;

  const updateHomePageStyle = useCallback((patch) => {
    setHomePageStyle((prev) => {
      const next = {
        ...prev,
        'portal_home_hero_section': {
          ...prev['portal_home_hero_section'],
          ...patch,
        },
      };
      updateHomeSetting(JSON.stringify(next));
      return next;
    });
  }, [setHomePageStyle, updateHomeSetting]);

  const updateCardsSection = (patch) => {
    setHomePageStyle((prev) => {
      const next = {
        ...prev,
        'portal_home_cards_section': {
          ...prev['portal_home_cards_section'],
          ...patch,
        },
      };
      updateHomeSetting(JSON.stringify(next));
      return next;
    });
  };

  return (
    <aside className="portal-home-content-settings">
      <div className="portal-setting-section">
        <Label>{gettext('Title')}</Label>
        <Input
          className="portal-setting-input"
          type="text"
          value={title_text}
          onChange={(e) => updateHomePageStyle({ title_text: e.target.value })}
          placeholder={gettext('Enter title')}
        />
      </div>

      <div className="portal-setting-section mt-3">
        <Label>{gettext('Title size')}</Label>
        <CustomizeSelect
          value={title_size || TITLE_SIZE_OPTIONS[0].value}
          options={TITLE_SIZE_OPTIONS}
          onChange={(value) => updateHomePageStyle({ title_size: value })}
          placeholder={gettext('Select size')}
        />
      </div>

      <div className="portal-setting-section mt-3">
        <Label>{gettext('Chat placeholder')}</Label>
        <Input
          className="portal-setting-input"
          type="text"
          value={description_text}
          onChange={(e) => updateHomePageStyle({ description_text: e.target.value })}
          placeholder={gettext('Enter description')}
        />
      </div>

      <div className="portal-setting-section mt-3">
        <Label>{gettext('Card layout')}</Label>
        <CustomizeSelect
          value={card_layout || CARD_LAYOUT_OPTIONS[0].value}
          options={CARD_LAYOUT_OPTIONS}
          onChange={(value) => updateCardsSection({ card_layout: value })}
          placeholder={gettext('Select layout')}
          searchable={false}
        />
      </div>
    </aside>
  );
};

export default HomeContentSettings;
