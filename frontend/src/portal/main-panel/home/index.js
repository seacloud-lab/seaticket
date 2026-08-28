import React, { useState } from 'react';
import classnames from 'classnames';
import slugid from 'slugid';
import { CenteredLoading, Icon, IconButton } from '@/components';
import { DEFAULT_PROJECT_ICON, gettext, PROJECT_ICON_ALL_LIST } from '@/constants';
import { usePortalSettings } from '@/portal/hooks/settings';
import { isMobile } from '@/utils/utils';
import PortalCardEditPanel from './card-edit-panel';
import PortalHomeChatInput from './chat-input';
import PortalHomeEditPanel from './edit-panel';
import { CARD_LAYOUT_OPTIONS, DEFAULT_NEW_CARD, getSafeCardLink, normalizeHomePageStyle } from './utils';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import { portalAPI } from '@/portal/api';
import { KNOWLEDGE_BASE_TYPE } from '@/project/main-panel/knowledge-base/constants';

import './index.css';

const { isEditMode, portalHomeSettings } = window.app.pageOptions;

const PortalHome = ({ projectUuid, onHomeChatSend }) => {
  const [isEdit, setIsEdit] = useState(false);
  const [homePageStyle, setHomePageStyle] = useState(() => normalizeHomePageStyle(portalHomeSettings));
  const [activeCard, setActiveCard] = useState('');
  const [selectedFeaturedArticle, setSelectedFeaturedArticle] = useState(null);
  const { updateHomeSetting, featuredArticles, isFeaturedArticlesLoading } = usePortalSettings();
  const { columns = [], records = [] } = featuredArticles || {};
  const titleColumn = columns.find(column => column.name === 'title');
  const columnTitles = records.map(record => ({ record, title: getCellValueByColumn(record, titleColumn) })).filter(({ title }) => title);

  const heroSection = homePageStyle['portal_home_hero_section'];
  const cardsSection = homePageStyle['portal_home_cards_section'];
  const { title_text, description_text, title_size, background_color, theme_type, theme_background_image_URL } = heroSection;
  const { card_layout, cards } = cardsSection;
  const validCards = Array.isArray(cards) ? cards.filter(Boolean) : [];
  const cardColumnCount = isMobile ? 1 : (CARD_LAYOUT_OPTIONS.includes(Number(card_layout)) ? Number(card_layout) : 3);

  const heroStyle = theme_type === 'image' && theme_background_image_URL
    ? { backgroundImage: `url(${theme_background_image_URL})` }
    : { backgroundColor: background_color };

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
      'portal_home_cards_section': {
        ...prev['portal_home_cards_section'],
        cards: [...(Array.isArray(prev['portal_home_cards_section']?.cards) ? prev['portal_home_cards_section'].cards : []), newCard],
      },
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

  const handleFeaturedArticleClick = (record) => {
    setSelectedFeaturedArticle({ ...record, _id: record._id || record._pk, type: KNOWLEDGE_BASE_TYPE });
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
              <h1 className="portal-home-title" style={{ fontSize: `${title_size}px` }}>{title_text}</h1>
              <PortalHomeChatInput description_text={description_text} onHomeChatSend={onHomeChatSend} />
            </div>
          </section>

          <section className="portal-home-cards" aria-label={gettext('Portal features')} style={{ gridTemplateColumns: `repeat(${cardColumnCount}, minmax(0, 1fr))` }}>
            {validCards.map((card) => (
              <article
                className={classnames('portal-home-card', { active: activeCard === card.id })}
                key={card.id}
                id={card.id}
                onClick={() => handleCardClick(card)}
              >
                <div className="portal-home-card-icon" aria-hidden="true">
                  <i
                    className={classnames('project-icon project-icon-style', {
                      [PROJECT_ICON_ALL_LIST.includes(card.icon) ? card.icon : DEFAULT_PROJECT_ICON]: true,
                    })}
                    style={{ color: '#FF8000' }}
                  />
                </div>
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
                <Icon symbol="plus" className="portal-home-card-add-icon" />
                <span className="portal-home-card-add-text">{gettext('Add card')}</span>
              </article>
            )}
          </section>

          <section className="portal-home-featured-articles">
            {isFeaturedArticlesLoading ? (
              <CenteredLoading />
            ) : (
              <>
                <h2 className="portal-home-featured-articles-title">Featured articles</h2>
                <div className="portal-home-featured-articles-list">
                  {columnTitles.map(({ record, title }) => (
                    <div
                      className="portal-home-featured-article-card"
                      onClick={() => handleFeaturedArticleClick(record)}
                      role="button"
                      tabIndex="0"
                      title={title}
                      key={record._pk}
                    >
                      <Icon symbol="knowledge-base" className="portal-home-featured-article-icon" aria-hidden="true" />
                      <div className="portal-home-featured-article-title">{title}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </main>
        {selectedFeaturedArticle && (
          <ResourceDetailsDialog
            projectUuid={projectUuid}
            resource={selectedFeaturedArticle}
            columns={columns}
            getKB={(projectUuid, knowledgeID) => portalAPI.getKBRecord(projectUuid, knowledgeID)}
            onToggle={() => setSelectedFeaturedArticle(null)}
            isShowInternalIcon={false}
          />
        )}
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
