import React, { useCallback, useState } from 'react';
import TopBar from '../../top-bar';
import { useKnowledgePage } from '../hooks/knowledge-page';
import { KNOWLEDGE_PAGE_SLUG_ID, KNOWLEDGE_CHILDREN_PAGE_SLUG_ID } from '../constants';
import { IconButton, CustomizeDropdownMenu, CustomizeDropdownMoreToggle, CustomizeDropdownItem } from '@/components';
import { Dropdown } from 'reactstrap';
import { gettext } from '@/constants';
import AddButton from '@/project/components/add-button';
import { EVENT_BUS_TYPE } from '@/project/constants/event-bus-type';
import eventBus from '@/utils/event-bus';

import './index.css';

const KnowledgeTopBar = ({ title }) => {
  const { pageSlugId, childrenPageSlugId, togglePageSlugId } = useKnowledgePage();

  const [isMoreMenuShow, setIsMoreMenuShow] = useState(false);
  const toggleMoreMenu = useCallback(() => setIsMoreMenuShow(prev => !prev), []);

  const renderLeftChildren = useCallback(() => {
    if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.ALL) {
      return (
        <div className="text-truncate">{title}</div>
      );
    }

    if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.NEW) {
      return (
        <>
          <IconButton
            icon="arrow-down"
            className="rotate-icon-90 sea-qa-project-toggle-knowledge-btn"
            onClick={() => togglePageSlugId(KNOWLEDGE_PAGE_SLUG_ID.ALL)}
          />
          <span className="text-truncate" title={gettext('New record')}>{gettext('New record')}</span>
        </>
      );
    }

    if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.TRASH) {
      return (
        <>
          <IconButton
            icon="arrow-down"
            className="rotate-icon-90 sea-qa-project-toggle-knowledge-btn"
            onClick={() => togglePageSlugId(KNOWLEDGE_PAGE_SLUG_ID.ALL)}
          />
          <span className="text-truncate" title={gettext('Deleted records')}>{gettext('Deleted records')}</span>
        </>
      );
    }

    const editTitle = gettext('Knowledge') + ' / #' + pageSlugId;
    return (
      <>
        <IconButton
          icon="arrow-down"
          className="rotate-icon-90 sea-qa-project-toggle-knowledge-btn"
          onClick={() => togglePageSlugId(KNOWLEDGE_PAGE_SLUG_ID.ALL)}
        />
        <span className="text-truncate" title={editTitle}>{editTitle}</span>
      </>
    );
  }, [pageSlugId, title, togglePageSlugId]);

  const renderRightChildren = useCallback(() => {
    if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.ALL) {
      return (
        <>
          <AddButton onClick={() => togglePageSlugId(KNOWLEDGE_PAGE_SLUG_ID.NEW)} text={gettext('New record')} icon="plus" className="mr-2" />
          <Dropdown isOpen={isMoreMenuShow} toggle={toggleMoreMenu} className="d-inline-flex">
            <CustomizeDropdownMoreToggle isOpen={isMoreMenuShow} />
            <CustomizeDropdownMenu>
              <CustomizeDropdownItem onClick={() => { togglePageSlugId(KNOWLEDGE_PAGE_SLUG_ID.TRASH); toggleMoreMenu(); }}>{gettext('Deleted records')}</CustomizeDropdownItem>
            </CustomizeDropdownMenu>
          </Dropdown>
        </>
      );
    }

    if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.TAGS && childrenPageSlugId === KNOWLEDGE_CHILDREN_PAGE_SLUG_ID.ALL) {
      return (
        <AddButton onClick={() => eventBus.dispatch(EVENT_BUS_TYPE.NEW_TAG)} text={gettext('New tag')} icon="plus" />
      );
    }

    if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.NEW || pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.TRASH) {
      return null;
    }

    if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.TAGS || pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.NEW) return null;

    return (
      <>
        <AddButton onClick={() => togglePageSlugId(KNOWLEDGE_PAGE_SLUG_ID.NEW)} text={gettext('New record')} icon="plus" className="mr-2" />
        <Dropdown isOpen={isMoreMenuShow} toggle={toggleMoreMenu} className="d-inline-flex">
          <CustomizeDropdownMoreToggle isOpen={isMoreMenuShow} />
          <CustomizeDropdownMenu>
            <CustomizeDropdownItem onClick={() => { togglePageSlugId(KNOWLEDGE_PAGE_SLUG_ID.TRASH); toggleMoreMenu(); }}>{gettext('Deleted records')}</CustomizeDropdownItem>
          </CustomizeDropdownMenu>
        </Dropdown>
      </>
    );
  }, [pageSlugId, childrenPageSlugId, togglePageSlugId, isMoreMenuShow, toggleMoreMenu]);

  return (
    <TopBar>
      {renderLeftChildren()}
      {renderRightChildren()}
    </TopBar>
  );
};

export default KnowledgeTopBar;
