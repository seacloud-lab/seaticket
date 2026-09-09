import React, { useRef, useState } from 'react';
import { Button, Label, Input } from 'reactstrap';
import classnames from 'classnames';
import { CustomizePopover, IconButton } from '@/components';
import { DEFAULT_PROJECT_ICON, gettext, PROJECT_ICON_ALL_LIST, PROJECT_ICON_COLORS } from '@/constants';

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
  const iconSelectorRef = useRef(null);
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

  return (
    <aside className="portal-home-edit-panel-card" aria-label={gettext('Edit panel')}>
      <div className="portal-home-edit-panel-header">
        <div className="portal-home-edit-panel-header-left" />
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
        <div ref={iconSelectorRef}>
          <div
            className="portal-home-edit-panel-input portal-home-card-icon-selector"
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
          {isIconPopoverOpen && (
            <CustomizePopover
              target={iconSelectorRef.current}
              hidePopover={() => setIsIconPopoverOpen(false)}
              hidePopoverWithEsc={() => setIsIconPopoverOpen(false)}
              className="portal-home-card-icon-popover"
            >
              <div className="portal-home-card-icon-content">
                {PROJECT_ICON_ALL_LIST.map((iconItem) => {
                  const isSelected = iconItem === selectedIcon;
                  return (
                    <div
                      key={iconItem}
                      className="portal-home-card-icon-item"
                      onClick={() => {
                        updateCardStyle({ icon: iconItem });
                        setIsIconPopoverOpen(false);
                      }}
                      role="button"
                      tabIndex={0}
                      style={{ backgroundColor: isSelected ? PROJECT_ICON_COLORS[0] : '' }}
                      title={`${gettext('Icon')} ${iconItem}`}
                      aria-label={`${gettext('Icon')} ${iconItem}`}
                    >
                      <span className="portal-home-card-icon-input" aria-selected={isSelected}>
                        <i
                          aria-hidden="true"
                          className={classnames('project-icon project-icon-style', {
                            [iconItem]: iconItem,
                            'icon-color-white': isSelected,
                          })}
                        />
                      </span>
                    </div>
                  );
                })}
              </div>
            </CustomizePopover>
          )}
        </div>
      </div>

      <div className="portal-home-edit-panel-delete-wrap">
        <Button color="danger" onClick={() => deleteCard(activeCard)}>
          {gettext('Delete card')}
        </Button>
      </div>
    </aside>
  );
};

export default PortalHomeCardEditPanel;
