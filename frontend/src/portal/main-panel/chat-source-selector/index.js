import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Popover, PopoverBody } from 'reactstrap';
import SearchInput from '@/components/search-input';
import { Icon, Switch } from '@/components';
import { gettext } from '@/constants';
import { DOCUMENT_CONNECTION_TYPE_MAP, ISSUE_CONNECTION_TYPE_MAP } from '@/project/main-panel/connections/constants';

import './index.css';

const KNOWLEDGE_BASE_SOURCE_ID = '__kb__';
const TICKET_SOURCE_ID = '__ticket__';
const EXTRA_SOURCE_ID_MAP = {
  knowledge_base: KNOWLEDGE_BASE_SOURCE_ID,
  ticket: TICKET_SOURCE_ID,
};

const getSelectedSourceIds = (value) => {
  const selectedSourceIds = new Set((value?.connection_ids || []).map(String));

  (value?.extra_sources || []).forEach((source) => {
    const sourceId = EXTRA_SOURCE_ID_MAP[source];
    if (sourceId) {
      selectedSourceIds.add(sourceId);
    }
  });

  return selectedSourceIds;
};

const getNextValue = (selectedSourceIds, connections) => {
  const selectedIds = new Set(Array.from(selectedSourceIds).map(String));
  const connectionIds = connections
    .filter((connection) => selectedIds.has(String(connection.id)))
    .map((connection) => connection.id);

  const extraSources = [];
  if (selectedIds.has(KNOWLEDGE_BASE_SOURCE_ID)) {
    extraSources.push('knowledge_base');
  }
  if (selectedIds.has(TICKET_SOURCE_ID)) {
    extraSources.push('ticket');
  }

  return {
    connection_ids: connectionIds,
    extra_sources: extraSources,
  };
};

const getSourceSection = (source) => {
  if (source.id === KNOWLEDGE_BASE_SOURCE_ID) return 'documents';
  if (source.id === TICKET_SOURCE_ID) return 'issues';
  if (DOCUMENT_CONNECTION_TYPE_MAP[source.type]) return 'documents';
  if (ISSUE_CONNECTION_TYPE_MAP[source.type]) return 'issues';
  return 'others';
};

const PortalChatSourceItem = ({ source, selected, disabled, onToggle }) => {
  return (
    <div className="portal-chat-source-item">
      <Switch
        className="portal-chat-source-item-switch"
        size="small"
        disabled={disabled}
        checked={selected}
        placeholder={<span className="text-truncate">{source.name}</span>}
        onChange={() => onToggle(source.id)}
      />
    </div>
  );
};

const PortalChatSourceSelector = ({ connections, disabled, value, onChange }) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const targetIdRef = useRef(`portal-chat-source-selector-${Math.random().toString(36).slice(2, 10)}`);
  const popoverRef = useRef(null);

  const sources = [
    ...connections,
    { id: KNOWLEDGE_BASE_SOURCE_ID, key: KNOWLEDGE_BASE_SOURCE_ID, name: gettext('Knowledge Base') },
    { id: TICKET_SOURCE_ID, key: TICKET_SOURCE_ID, name: gettext('Ticket') },
  ];

  const selectedSourceIds = getSelectedSourceIds(value);
  const selectedCount = selectedSourceIds.size;

  const filteredSources = !searchValue
    ? sources
    : sources.filter((source) => {
      return (source.name || '').toLocaleLowerCase().includes(searchValue.trim().toLocaleLowerCase());
    });

  const sections = {
    documents: [],
    issues: [],
    others: [],
  };

  filteredSources.forEach((source) => {
    sections[getSourceSection(source)].push(source);
  });

  const sectionList = [
    { key: 'documents', title: gettext('Documents'), items: sections.documents },
    { key: 'issues', title: gettext('Issues'), items: sections.issues },
    { key: 'others', title: gettext('Other'), items: sections.others },
  ].filter((section) => section.items.length > 0);

  const closePopover = () => {
    setIsPopoverOpen(false);
    setSearchValue('');
  };

  const togglePopover = () => {
    if (disabled) return;
    if (isPopoverOpen) {
      closePopover();
      return;
    }
    setIsPopoverOpen(true);
  };

  const updateValue = (nextSelectedSourceIds) => {
    onChange(getNextValue(nextSelectedSourceIds, connections));
  };

  const toggleSource = (sourceId) => {
    const nextSelectedSourceIds = new Set(selectedSourceIds);
    const normalizedSourceId = String(sourceId);

    if (nextSelectedSourceIds.has(normalizedSourceId)) {
      nextSelectedSourceIds.delete(normalizedSourceId);
    } else {
      nextSelectedSourceIds.add(normalizedSourceId);
    }

    updateValue(nextSelectedSourceIds);
  };

  const selectAll = () => {
    updateValue(new Set(sources.map((source) => String(source.id))));
  };

  const clearAll = () => {
    updateValue(new Set());
  };

  const onTriggerKeyDown = (event) => {
    if (disabled) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      togglePopover();
    }
  };

  useEffect(() => {
    if (!isPopoverOpen) return undefined;

    const handleMouseDown = (event) => {
      const targetElement = document.getElementById(targetIdRef.current);
      if (targetElement?.contains(event.target) || popoverRef.current?.contains(event.target)) {
        return;
      }
      setIsPopoverOpen(false);
      setSearchValue('');
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsPopoverOpen(false);
        setSearchValue('');
      }
    };

    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPopoverOpen]);

  useEffect(() => {
    if (disabled && isPopoverOpen) {
      setIsPopoverOpen(false);
      setSearchValue('');
    }
  }, [disabled, isPopoverOpen]);

  return (
    <div className="portal-chat-source-selector">
      <div
        id={targetIdRef.current}
        className="portal-chat-source-trigger"
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={togglePopover}
        onKeyDown={onTriggerKeyDown}
      >
        <div className={classNames('portal-chat-source-toggle', {
          'active': isPopoverOpen && selectedCount > 0,
          'highlighted': selectedCount > 0,
          'disabled': disabled,
        })}>
          <div className="portal-chat-source-label">
            {selectedCount > 0 ? `${selectedCount} ${gettext('Sources')}` : gettext('Sources')}
          </div>
          <Icon symbol="arrow-down" />
        </div>
      </div>
      <Popover
        placement="bottom-start"
        isOpen={isPopoverOpen && !disabled}
        target={targetIdRef.current}
        hideArrow={true}
        fade={false}
        className="portal-chat-source-popover"
      >
        <PopoverBody className="portal-chat-source-popover-body">
          <div ref={popoverRef} className="portal-chat-source-popover-content">
            <div className="portal-chat-source-search">
              <SearchInput
                autoFocus={true}
                isShowSearchIcon={false}
                placeholder={gettext('Search')}
                value={searchValue}
                size={28}
                onChange={setSearchValue}
                onClear={() => setSearchValue('')}
                isShowClearIcon={true}
              />
            </div>
            <div className={classNames('portal-chat-source-list', { 'empty': sectionList.length === 0 })}>
              {sectionList.length === 0 && (
                <div className="portal-chat-source-empty">{gettext('No sources found')}</div>
              )}
              {sectionList.map((section) => (
                <div className="portal-chat-source-section" key={section.key}>
                  <div className="portal-chat-source-section-title">{section.title}</div>
                  {section.items.map((source) => (
                    <PortalChatSourceItem
                      key={String(source.id)}
                      source={source}
                      selected={selectedSourceIds.has(String(source.id))}
                      disabled={disabled}
                      onToggle={toggleSource}
                    />
                  ))}
                </div>
              ))}
            </div>
            {!searchValue && (
              <div className="portal-chat-source-actions">
                <button type="button" className="portal-chat-source-action" onClick={clearAll}>
                  {gettext('Clear all')}
                </button>
                <button type="button" className="portal-chat-source-action" onClick={selectAll}>
                  {gettext('Select all')}
                </button>
              </div>
            )}
          </div>
        </PopoverBody>
      </Popover>
    </div>
  );
};

PortalChatSourceItem.propTypes = {
  source: PropTypes.object.isRequired,
  selected: PropTypes.bool,
  disabled: PropTypes.bool,
  onToggle: PropTypes.func.isRequired,
};

PortalChatSourceSelector.propTypes = {
  connections: PropTypes.array.isRequired,
  disabled: PropTypes.bool,
  value: PropTypes.shape({
    connection_ids: PropTypes.array,
    extra_sources: PropTypes.array,
  }),
  onChange: PropTypes.func.isRequired,
};

export default PortalChatSourceSelector;
