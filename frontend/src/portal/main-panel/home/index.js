import React, { useState } from 'react';
import classnames from 'classnames';
import { IconButton } from '@/components';
import { gettext } from '@/constants';
import { usePortalSettings } from '@/portal/hooks/settings';
import PortalHomeEditPanel from './edit-panel';
import PortalCardEditPanel from './card-edit-panel';
import { normalizeHomePageStyle } from './utils';

import './index.css';

const { isEditMode, portalHomeSetting } = window.app.pageOptions;

const PortalHome = () => {
  const [isEdit, setIsEdit] = useState(false);
  const [homePageStyle, setHomePageStyle] = useState(() => normalizeHomePageStyle(portalHomeSetting));
  const [activeCard, setActiveCard] = useState('');
  const { updateHomeSetting } = usePortalSettings();

  const { titleText, descriptionText, titleSize, backgroundColor, cards } = homePageStyle;

  const closeEditPanel = () => {
    updateHomeSetting(JSON.stringify(homePageStyle));
    setIsEdit(false);
    setActiveCard('');
  };

  return (
    <div className={`portal-home-page${isEdit ? ' is-edit' : ''}`} style={{ backgroundColor }}>
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
          <section className="portal-home-hero">
            <div className="portal-home-hero-content">
              <h1 className="portal-home-title" style={{ fontSize: `${titleSize}px` }}>{titleText}</h1>

              <div className="portal-home-chat-input" aria-label={gettext('Chat with AI')}>
                <div className="portal-home-chat-placeholder">{descriptionText}</div>
                <button type="button" className="portal-home-action-btn portal-home-action-btn-send" aria-label={gettext('Send')}>
                  <span>↑</span>
                </button>
              </div>
            </div>
          </section>

          <section className="portal-home-cards" aria-label={gettext('Portal features')}>
            {cards.map((card) => (
              <article
                className={classnames('portal-home-card', { active: activeCard === card.id })}
                key={card.id}
                id={card.id}
                onClick={isEditMode ? () => { setIsEdit(true); setActiveCard(card.id); } : () => { card.link && window.open(card.link); }}
              >
                <div className="portal-home-card-icon" aria-hidden="true">{card.icon}</div>
                <div className="portal-home-card-body">
                  <h2 className="portal-home-card-title">
                    {card.title}
                    <span className="portal-home-card-title-sub">{card.subtitle}</span>
                  </h2>
                  <p className="portal-home-card-description">{card.description}</p>
                  <p className="portal-home-card-note">{card.note}</p>
                </div>
              </article>
            ))}
          </section>
        </main>

        {isEditMode && isEdit && !activeCard && (
          <PortalHomeEditPanel
            homePageStyle={homePageStyle}
            setHomePageStyle={setHomePageStyle}
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
