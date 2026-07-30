import React, { useState } from 'react';
import classnames from 'classnames';
import slugid from 'slugid';
import { Icon, IconButton } from '@/components';
import { gettext } from '@/constants';
import { usePortalSettings } from '@/portal/hooks/settings';
import PortalHomeEditPanel from './edit-panel';
import PortalCardEditPanel from './card-edit-panel';
import PortalHomeChatInput from './chat-input';
import { CARD_LAYOUT_OPTIONS, DEFAULT_NEW_CARD, getSafeCardLink, normalizeHomePageStyle } from './utils';

import './index.css';

const { isEditMode, portalHomeSetting } = window.app.pageOptions;

const PortalHome = ({ onHomeChatSend }) => {
  const [isEdit, setIsEdit] = useState(false);
  const [homePageStyle, setHomePageStyle] = useState(() => normalizeHomePageStyle(portalHomeSetting));
  const [activeCard, setActiveCard] = useState('');
  const { updateHomeSetting } = usePortalSettings();

  const { titleText, descriptionText, titleSize, backgroundColor, cardLayout, cards, themeType, themeBackgroundImageURL } = homePageStyle;

  const heroStyle = themeType === 'image' && themeBackgroundImageURL
    ? { backgroundImage: `url(${themeBackgroundImageURL})` }
    : { backgroundColor };

  const closeEditPanel = () => {
    updateHomeSetting(JSON.stringify(homePageStyle));
    setIsEdit(false);
    setActiveCard('');
  };

  const addCard = () => {
    const newCard = {
      ...DEFAULT_NEW_CARD,
      id: slugid.nice(4),
    };

    setHomePageStyle((prev) => ({
      ...prev,
      cards: [...(Array.isArray(prev.cards) ? prev.cards : []), newCard],
    }));
    setIsEdit(true);
    setActiveCard(newCard.id);
  };

  const handleCardClick = (card) => {
    if (isEditMode) {
      setIsEdit(true);
      setActiveCard(card.id);
      return;
    }
    const safeLink = getSafeCardLink(card.link);
    if (safeLink) {
      window.open(safeLink, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className={`portal-home-page${isEdit ? ' is-edit' : ''}`}>
      {isEditMode && !isEdit && (
        <div className="portal-home-edit-btn-wrap">
          <IconButton
            icon="edit"
            className="portal-home-edit-btn"
            onClick={() => setIsEdit(true)}
            title={gettext('Edit')}
            aria-label={gettext('Edit')}
          />
        </div>
      )}

      <div className="portal-home-layout">

        <main className="portal-home-main">
          <section className="portal-home-hero" style={heroStyle}>
            <div className="portal-home-hero-content">
              <h1 className="portal-home-title" style={{ fontSize: `${titleSize}px` }}>{titleText}</h1>
              <PortalHomeChatInput descriptionText={descriptionText} onHomeChatSend={onHomeChatSend} />
            </div>
          </section>

          <section className="portal-home-cards" aria-label={gettext('Portal features')} style={{ gridTemplateColumns: `repeat(${CARD_LAYOUT_OPTIONS.includes(Number(cardLayout)) ? Number(cardLayout) : 3}, minmax(0, 1fr))` }}>
            {cards.map((card) => (
              <article
                className={classnames('portal-home-card', { active: activeCard === card.id })}
                key={card.id}
                id={card.id}
                onClick={() => handleCardClick(card)}
              >
                <div className="portal-home-card-icon" aria-hidden="true">{card.icon}</div>
                <div className="portal-home-card-body">
                  <h2 className="portal-home-card-title">{card.title}</h2>
                  <p className="portal-home-card-description">{card.description}</p>
                </div>
              </article>
            ))}
            {isEditMode && (
              <article
                className={classnames('portal-home-card', 'portal-home-card-add', { active: false })}
                key="portal-home-card-add"
                onClick={addCard}
              >
                <Icon symbol="narrow" className="portal-home-card-add-icon" />
                <span className="portal-home-card-add-text">{gettext('Add card')}</span>
              </article>
            )}
          </section>
        </main>

        {isEditMode && isEdit && !activeCard && (
          <PortalHomeEditPanel
            homePageStyle={homePageStyle}
            setHomePageStyle={setHomePageStyle}
            updateHomeSetting={updateHomeSetting}
            onClose={closeEditPanel}
          />
        )}
        {isEditMode && isEdit && activeCard && (
          <PortalCardEditPanel
            homePageStyle={homePageStyle}
            activeCard={activeCard}
            setActiveCard={setActiveCard}
            setHomePageStyle={setHomePageStyle}
            onClose={closeEditPanel}
          />
        )}
      </div>
    </div>
  );
};

export default PortalHome;
