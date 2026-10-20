import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { Switch, SearchInput, CustomizePopover, SaveStatus } from '@/components';
import SelectTrigger from '@/components/customize-select/select-trigger';
import { gettext } from '@/constants';
import { DOCUMENT_CONNECTION_TYPE_MAP, ISSUE_CONNECTION_TYPE_MAP, TASK_CONNECTION_TYPE_MAP } from '@/project/main-panel/connections/constants';
import ObjectUtils from '@/utils/object-utils';
import { normalizeChatAllowedSources } from '../../utils';

import './index.css';

const KNOWLEDGE_BASE_SOURCE_ID = '__kb__';
const TICKET_SOURCE_ID = '__ticket__';
const EXTRA_SOURCE_ID_MAP = {
  knowledge_base: KNOWLEDGE_BASE_SOURCE_ID,
  ticket: TICKET_SOURCE_ID,
};

const getSelectedSourceIds = (value = {}) => {
  const { connection_ids, extra_sources } = value;
  let selectedSourceIds = [...connection_ids];

  (extra_sources || []).forEach((source) => {
    const sourceId = EXTRA_SOURCE_ID_MAP[source];
    if (sourceId) {
      selectedSourceIds.push(sourceId);
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
  if (TASK_CONNECTION_TYPE_MAP[source.type]) return 'tasks';
  return 'others';
};

const PortalChatSourceItem = ({ source, selected, disabled, onToggle }) => {
  return (
    <div className="portal-chat-source-item">
      <Switch
        className="portal-chat-source-item-switch"
        disabled={disabled}
        checked={selected}
        placeholder={<span className="text-truncate">{source.name}</span>}
        onChange={() => onToggle(source.id)}
        fontWeight={400}
      />
    </div>
  );
};

const PortalChatSourceSelector = ({ connections, disabled, value: oldValue, onChange }) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [value, setValue] = useState([]);

  const targetRef = useRef(null);

  const sources = useMemo(() => (
    [
      ...connections,
      { id: KNOWLEDGE_BASE_SOURCE_ID, key: KNOWLEDGE_BASE_SOURCE_ID, name: gettext('Knowledge Base') },
      { id: TICKET_SOURCE_ID, key: TICKET_SOURCE_ID, name: gettext('Ticket') },
    ]
  ), [connections]);

  const newValue = useMemo(() => getNextValue(value, connections), [value, connections]);

  const filteredSources = !searchValue
    ? sources
    : sources.filter((source) => {
      return (source.name || '').toLocaleLowerCase().includes(searchValue.trim().toLocaleLowerCase());
    });

  const sections = {
    documents: [],
    issues: [],
    tasks: [],
    others: [],
  };

  filteredSources.forEach((source) => {
    sections[getSourceSection(source)].push(source);
  });

  const sectionList = [
    { key: 'documents', title: gettext('Documents'), items: sections.documents },
    { key: 'issues', title: gettext('Issues'), items: sections.issues },
    { key: 'tasks', title: gettext('Task'), items: sections.tasks },
    { key: 'others', title: gettext('Other'), items: sections.others },
  ].filter((section) => section.items.length > 0);

  const closePopover = useCallback(() => {
    setIsPopoverOpen(false);
    setSearchValue('');
  }, []);

  const handleChange = useCallback((callback) => {
    closePopover();
    onChange(newValue, callback);
  }, [newValue, onChange, closePopover]);

  const openPopover = () => {
    if (disabled || isPopoverOpen) return;
    setIsPopoverOpen(true);
  };

  const toggleSource = useCallback((sourceId) => {
    const sourceIdIndex = value.findIndex(v => v === sourceId);
    let newValue = value.slice(0);
    if (sourceIdIndex > -1) {
      newValue.splice(sourceIdIndex, 1);
    } else {
      newValue.push(sourceId);
    }
    setValue(newValue);
  }, [value]);

  const selectAll = () => {
    const newValue = connections.map(connection => connection.id);
    setValue([...newValue, KNOWLEDGE_BASE_SOURCE_ID, TICKET_SOURCE_ID]);
  };

  const clearAll = () => {
    setValue([]);
  };

  useEffect(() => {
    if (disabled && isPopoverOpen) {
      setIsPopoverOpen(false);
      setSearchValue('');
    }
  }, [disabled, isPopoverOpen]);

  useEffect(() => {
    const normalizeSources = normalizeChatAllowedSources(oldValue, connections);
    const value = getSelectedSourceIds(normalizeSources);
    setValue(value);
  }, [oldValue, connections]);

  const selectedCount = value.length;

  return (
    <SaveStatus callback={handleChange}>
      {({ callback }) => (
        <>
          <SelectTrigger
            innerRef={targetRef}
            disabled={disabled}
            focus={isPopoverOpen}
            highlight={selectedCount > 0}
            hasBorder={false}
            selectedValue={(
              <span className="selected-option-show">
                {selectedCount > 0 ? `${selectedCount} ${gettext('Sources')}` : gettext('Sources')}
              </span>
            )}
            onClick={openPopover}
          />
          {isPopoverOpen && (
            <CustomizePopover
              placement="bottom-start"
              isOpen={isPopoverOpen && !disabled}
              target={targetRef}
              hideArrow={true}
              fade={false}
              className="portal-chat-source-popover"
              containerClassName="portal-chat-source-popover-content"
              hidePopover={ObjectUtils.isSameObject(newValue, oldValue) ? closePopover : callback}
              hidePopoverWithEsc={ObjectUtils.isSameObject(newValue, oldValue) ? closePopover : callback}
            >
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
                        selected={value.includes(source.id)}
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
            </CustomizePopover>
          )}
        </>
      )}
    </SaveStatus>
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
