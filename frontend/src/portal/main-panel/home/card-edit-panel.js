import React from 'react';
import { Label, Input } from 'reactstrap';
import Icon from '@/components/icon';
import { gettext } from '@/constants';
import CustomizeSelect from '@/components/customize-select';

import './card-edit-panel.css';

const ICON_OPTIONS = [
  { value: '👥', name: '👥 Team', label: <span>👥 Team</span> },
  { value: '🤖', name: '🤖 AI', label: <span>🤖 AI</span> },
  { value: '🗂️', name: '🗂️ Ticket', label: <span>🗂️ Ticket</span> },
  { value: '💬', name: '💬 Chat', label: <span>💬 Chat</span> },
  { value: '🔄', name: '🔄 Sync', label: <span>🔄 Sync</span> },
  { value: '🧩', name: '🧩 Link', label: <span>🧩 Link</span> },
];

const DEFAULT_CARD = {
  title: '',
  description: '',
  link: '',
  icon: ICON_OPTIONS[0].value,
};

const PortalHomeCardEditPanel = ({ homePageStyle = {}, activeCard, setActiveCard, setHomePageStyle, onClose }) => {
  const cards = Array.isArray(homePageStyle.cards) ? homePageStyle.cards : [];
  const cardStyle = cards.find(card => card.id === activeCard) || DEFAULT_CARD;

  const {
    title = '',
    description = '',
    link = '',
    icon = ICON_OPTIONS[0].value,
  } = cardStyle;

  const iconValue = ICON_OPTIONS.find(option => option.value === icon) || ICON_OPTIONS[0];

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
      cards: nextCards,
    }));

    setActiveCard(activeCard);
  };

  return (
    <aside className="portal-home-edit-panel-card" aria-label={gettext('Edit panel')}>
      <div className="portal-home-edit-panel-header">
        <div className="portal-home-edit-panel-header-left" />
        <div className="portal-home-edit-panel-title">{gettext('Card settings')}</div>
        <span className="portal-home-edit-panel-close" onClick={onClose} role="button" tabIndex={0}>
          <Icon symbol="close" className="portal-home-edit-panel-close-icon" />
        </span>
      </div>

      <div className="portal-home-edit-panel-section">
        <Label>{gettext('Title')}</Label>
        <Input
          className="portal-home-edit-panel-input"
          type="text"
          value={title}
          onChange={(e) => updateCardStyle({ title: e.target.value })}
          placeholder={gettext('Enter title')}
        />
      </div>

      <div className="portal-home-edit-panel-section">
        <Label>{gettext('Description')}</Label>
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
        <Label>{gettext('Link')}</Label>
        <Input
          className="portal-home-edit-panel-input"
          type="text"
          value={link}
          onChange={(e) => updateCardStyle({ link: e.target.value })}
          placeholder={gettext('Enter link')}
        />
      </div>

      <div className="portal-home-edit-panel-section">
        <Label>{gettext('Icon')}</Label>
        <CustomizeSelect
          value={iconValue}
          options={ICON_OPTIONS}
          onChange={(option) => updateCardStyle({ icon: option.value })}
          placeholder={gettext('Select icon')}
        />
      </div>
    </aside>
  );
};

export default PortalHomeCardEditPanel;
