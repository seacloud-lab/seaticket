import React from 'react';
import { Button, Label, Input } from 'reactstrap';
import { gettext } from '@/constants';
import CustomizeSelect from '@/components/customize-select';
import { IconButton } from '@/components';

import './card-edit-panel.css';

const ICON_OPTIONS = [
  { value: '👥', name: '👥 Team', label: <span>👥</span> },
  { value: '🤖', name: '🤖 AI', label: <span>🤖</span> },
  { value: '🗂️', name: '🗂️ Ticket', label: <span>🗂️</span> },
  { value: '💬', name: '💬 Chat', label: <span>💬</span> },
  { value: '🔄', name: '🔄 Sync', label: <span>🔄</span> },
  { value: '🧩', name: '🧩 Link', label: <span>🧩</span> },
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

  const deleteCard = (cardId) => {
    const nextCards = cards.filter(card => card.id !== cardId);
    setHomePageStyle((prev) => ({
      ...prev,
      cards: nextCards,
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
        <CustomizeSelect
          value={iconValue}
          options={ICON_OPTIONS}
          onChange={(value) => updateCardStyle({ icon: value })}
          placeholder={gettext('Select icon')}
        />
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
