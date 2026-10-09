import React, { useEffect, useRef, useState } from 'react';
import classnames from 'classnames';
import slugid from 'slugid';
import { CenteredLoading, Icon, IconButton } from '@/components';
import { DEFAULT_PROJECT_ICON, gettext, PROJECT_ICON_ALL_LIST } from '@/constants';
import { portalAPI } from '@/portal/api';
import { usePortalSettings } from '@/portal/hooks/settings';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import { KNOWLEDGE_BASE_TYPE } from '@/project/main-panel/knowledge-base/constants';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { isMobile } from '@/utils/utils';
import PortalCardEditPanel from './card-edit-panel';
import PortalHomeChatInput from './chat-input';
import PortalHomeEditPanel from './edit-panel';
import { CARD_LAYOUT_OPTIONS, DEFAULT_NEW_CARD, getSafeCardLink, normalizeHomePageStyle } from './utils';

import './index.css';

const { isEditMode, portalHomeSettings } = window.app.pageOptions;
const CARD_ORDER_MIME_TYPE = 'application/portal-home-card-order';

const PortalHome = ({ projectUuid, onHomeChatSend }) => {
  const [isEdit, setIsEdit] = useState(false);
  const [homePageStyle, setHomePageStyle] = useState(() => normalizeHomePageStyle(portalHomeSettings));
  const [activeCard, setActiveCard] = useState('');
  const [draggingCardId, setDraggingCardId] = useState('');
  const [dragOverCardId, setDragOverCardId] = useState('');
  const [selfDropIndicator, setSelfDropIndicator] = useState(null);
  const [selectedFeaturedArticle, setSelectedFeaturedArticle] = useState(null);
  const cardDragPreviewRef = useRef(null);
  const { updateHomeSetting, featuredArticles, isFeaturedArticlesLoading } = usePortalSettings();
  const { columns = [], records = [] } = featuredArticles || {};
  const titleColumn = columns.find(column => column.name === 'title');
  const featuredArticleItems = records.map(record => ({ record, title: getCellValueByColumn(record, titleColumn) })).filter(({ title }) => title);

  const heroSection = homePageStyle['portal_home_hero_section'];
  const cardsSection = homePageStyle['portal_home_cards_section'];
  const { title_text, description_text, title_size, background_color, theme_type, theme_background_image_URL } = heroSection;
  const { card_layout, cards } = cardsSection;
  const validCards = Array.isArray(cards) ? cards.filter(Boolean) : [];
  const draggingCardIndex = validCards.findIndex(card => card.id === draggingCardId);
  const cardColumnCount = isMobile ? 1 : (CARD_LAYOUT_OPTIONS.includes(Number(card_layout)) ? Number(card_layout) : 3);

  const heroStyle = theme_type === 'image' && theme_background_image_URL
    ? { backgroundImage: `url(${theme_background_image_URL})` }
    : { backgroundColor: background_color };

  useEffect(() => {
    return () => {
      cardDragPreviewRef.current?.remove();
    };
  }, []);

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

  const handleCardDragStart = (event, cardId) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(CARD_ORDER_MIME_TYPE, cardId);
    const cardElement = event.currentTarget.closest('.portal-home-card');
    if (cardElement) {
      cardDragPreviewRef.current?.remove();
      const { left, top, width, height } = cardElement.getBoundingClientRect();
      const previewPage = document.createElement('div');
      const previewCards = document.createElement('div');
      const previewCard = cardElement.cloneNode(true);

      previewPage.className = 'portal-home-page';
      previewCards.className = 'portal-home-cards';
      previewCard.removeAttribute('id');
      previewCard.classList.remove('dragging', 'drop-before', 'drop-after');
      Object.assign(previewPage.style, {
        left: '-10000px',
        pointerEvents: 'none',
        position: 'fixed',
        top: '-10000px',
        width: `${width}px`,
      });
      Object.assign(previewCards.style, {
        display: 'block',
        margin: '0',
        width: `${width}px`,
      });
      Object.assign(previewCard.style, {
        borderRadius: '16px',
        boxSizing: 'border-box',
        height: `${height}px`,
        opacity: '0.45',
        overflow: 'hidden',
        width: `${width}px`,
      });
      previewCards.appendChild(previewCard);
      previewPage.appendChild(previewCards);
      document.body.appendChild(previewPage);
      cardDragPreviewRef.current = previewPage;
      event.dataTransfer.setDragImage(previewCard, event.clientX - left, event.clientY - top);
    }
    setDraggingCardId(cardId);
  };

  const handleCardDragOver = (event, cardId) => {
    if (!draggingCardId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverCardId(cardId);
    if (draggingCardId !== cardId) {
      setSelfDropIndicator(null);
      return;
    }

    const cardsElement = event.currentTarget.closest('.portal-home-cards');
    if (!cardsElement) return;
    const cardRect = event.currentTarget.getBoundingClientRect();
    const cardsRect = cardsElement.getBoundingClientRect();
    const columnGap = parseFloat(window.getComputedStyle(cardsElement).columnGap) || 0;
    setSelfDropIndicator({
      height: cardRect.height,
      left: cardRect.left - cardsRect.left - columnGap / 2,
      top: cardRect.top - cardsRect.top,
    });
  };

  const handleCardDrop = (event, targetCardId) => {
    event.preventDefault();
    const sourceCardId = event.dataTransfer.getData(CARD_ORDER_MIME_TYPE);
    if (!sourceCardId || sourceCardId === targetCardId) return;

    setHomePageStyle((prev) => {
      const previousCards = Array.isArray(prev['portal_home_cards_section']?.cards)
        ? prev['portal_home_cards_section'].cards
        : [];
      const sourceIndex = previousCards.findIndex(card => card?.id === sourceCardId);
      const targetIndex = previousCards.findIndex(card => card?.id === targetCardId);
      if (sourceIndex < 0 || targetIndex < 0) return prev;

      const nextCards = previousCards.slice();
      const [sourceCard] = nextCards.splice(sourceIndex, 1);
      nextCards.splice(targetIndex, 0, sourceCard);
      return {
        ...prev,
        'portal_home_cards_section': {
          ...prev['portal_home_cards_section'],
          cards: nextCards,
        },
      };
    });
  };

  const clearCardDragState = () => {
    cardDragPreviewRef.current?.remove();
    cardDragPreviewRef.current = null;
    setDraggingCardId('');
    setDragOverCardId('');
    setSelfDropIndicator(null);
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
            {validCards.map((card, cardIndex) => (
              <article
                className={classnames('portal-home-card', {
                  active: activeCard === card.id,
                  dragging: draggingCardId === card.id,
                  'drop-before': dragOverCardId === card.id && draggingCardIndex > cardIndex,
                  'drop-after': dragOverCardId === card.id && draggingCardIndex < cardIndex,
                })}
                key={card.id}
                id={card.id}
                onClick={() => handleCardClick(card)}
                onDragOver={(event) => handleCardDragOver(event, card.id)}
                onDrop={(event) => handleCardDrop(event, card.id)}
              >
                {isEditMode && (
                  <IconButton
                    className="portal-home-card-drag-handle"
                    icon="drag"
                    draggable={true}
                    onClick={(event) => event.stopPropagation()}
                    onDragStart={(event) => handleCardDragStart(event, card.id)}
                    onDragEnd={clearCardDragState}
                    title={gettext('Drag to reorder')}
                    aria-label={gettext('Drag to reorder')}
                  />
                )}
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
            {selfDropIndicator && (
              <span
                className="portal-home-card-self-drop-indicator"
                style={selfDropIndicator}
              />
            )}
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

          {(isFeaturedArticlesLoading || featuredArticleItems.length > 0) && (
            <section className="portal-home-featured-articles">
              {isFeaturedArticlesLoading ? (
                <CenteredLoading />
              ) : (
                <>
                  <h2 className="portal-home-featured-articles-title">{gettext('Featured')}</h2>
                  <div className="portal-home-featured-articles-list">
                    {featuredArticleItems.map(({ record, title }) => (
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
          )}
        </main>
        {selectedFeaturedArticle && (
          <ResourceDetailsDialog
            projectUuid={projectUuid}
            resource={selectedFeaturedArticle}
            columns={columns}
            getKB={(projectUuid, knowledgeID) => portalAPI.getKBRecord(projectUuid, knowledgeID)}
            onToggle={() => setSelectedFeaturedArticle(null)}
            isSupportPortal={true}
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
