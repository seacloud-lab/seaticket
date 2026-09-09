import React, { useState } from 'react';
import { Button, Label, Input } from 'reactstrap';
import { IconButton } from '@/components';
import { DEFAULT_PROJECT_ICON, gettext, PROJECT_ICON_ALL_LIST } from '@/constants';
import CardSelectIconPanel from './card-select-icon-panel';

import './card-edit-panel.css';

const DEFAULT_CARD = {
  title: '',
  description: '',
  link: '',
  icon: DEFAULT_PROJECT_ICON,
};

const PortalHomeCardEditPanel = ({ homePageStyle = {}, activeCard, setActiveCard, setHomePageStyle, onClose }) => {
  const cardsSection = homePageStyle['portal_home_cards_section'] || {};
  const cards = Array.isArray(cardsSection.cards) ? cardsSection.cards : [];
  const cardStyle = cards.find(card => card.id === activeCard) || DEFAULT_CARD;

  const {
    title = '',
    description = '',
    link = '',
    icon = DEFAULT_PROJECT_ICON,
  } = cardStyle;
  const [isIconPopoverOpen, setIsIconPopoverOpen] = useState(false);
  const selectedIcon = PROJECT_ICON_ALL_LIST.includes(icon) ? icon : DEFAULT_PROJECT_ICON;

  const updateCardStyle = (patch) => {
    const nextCards = cards.map((card) => {
      if (card.id !== activeCard) return card;
      return {
        ...card,
        ...patch,
      };
    });

    setHomePageStyle((prev) => ({
      ...prev,
      'portal_home_cards_section': {
        ...prev['portal_home_cards_section'],
        cards: nextCards,
      },
    }));

    setActiveCard(activeCard);
  };

  const deleteCard = (cardId) => {
    const nextCards = cards.filter(card => card.id !== cardId);
    setHomePageStyle((prev) => ({
      ...prev,
      'portal_home_cards_section': {
        ...prev['portal_home_cards_section'],
        cards: nextCards,
      },
    }));
    setActiveCard('');
  };

  const onSelectIcon = (selectedIcon) => {
    updateCardStyle({ icon: selectedIcon });
    setIsIconPopoverOpen(false);
  };

  return (
    <>
      <aside className="portal-home-edit-panel-card" aria-label={gettext('Edit panel')}>
        <div className="portal-home-edit-panel-header">
          <div className="portal-home-edit-panel-title">{gettext('Card settings')}</div>
          <IconButton
            icon="close"
            onClick={onClose}
            title={gettext('Close')}
            aria-label={gettext('Close')}
          />
        </div>

        <div className="portal-home-edit-panel-section">
          <Label>{gettext('Card title')}</Label>
          <Input
            className="portal-home-edit-panel-input"
            type="text"
            value={title}
            onChange={(e) => updateCardStyle({ title: e.target.value })}
            placeholder={gettext('Enter title')}
          />
        </div>

        <div className="portal-home-edit-panel-section">
          <Label>{gettext('Card description')}</Label>
          <Input
            className="portal-home-edit-panel-input"
            type="textarea"
            rows={5}
            value={description}
            style={{ minHeight: '100px' }}
            onChange={(e) => updateCardStyle({ description: e.target.value })}
            placeholder={gettext('Enter description')}
          />
        </div>

        <div className="portal-home-edit-panel-section">
          <Label>{gettext('Card link')}</Label>
          <Input
            className="portal-home-edit-panel-input"
            type="text"
            value={link}
            onChange={(e) => updateCardStyle({ link: e.target.value })}
            placeholder={gettext('Enter link')}
          />
        </div>

        <div className="portal-home-edit-panel-section">
          <Label>{gettext('Card icon')}</Label>
          <div
            className="portal-home-card-icon-selector mt-1"
            onClick={() => setIsIconPopoverOpen(true)}
            role="button"
            tabIndex={0}
            aria-label={gettext('Select icon')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setIsIconPopoverOpen(true);
              }
            }}
          >
            <i className={`project-icon project-icon-style ${selectedIcon}`} aria-hidden="true" />
          </div>
        </div>

        <div className="mt-5">
          <Button color="danger" className="w-100" outline onClick={() => deleteCard(activeCard)}>
            {gettext('Delete card')}
          </Button>
        </div>
      </aside>
      {isIconPopoverOpen && (
        <CardSelectIconPanel
          currentIcon={selectedIcon}
          onPrevious={() => setIsIconPopoverOpen(false)}
          onSubmit={onSelectIcon}
        />
      )}
    </>
  );
};

export default PortalHomeCardEditPanel;
