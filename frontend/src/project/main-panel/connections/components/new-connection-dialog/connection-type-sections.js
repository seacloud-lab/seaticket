import React, { useCallback, useEffect, useMemo, useState } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { gettext } from '@/constants';
import { IconButton } from '@/components';
import { CONNECTION_SUB_TYPE_MAP } from '../../constants';
import { getConnectionIcon } from '../../utils';

import './connection-type-sections.css';

const ConnectionTypeSections = ({ availableConnectionTypes, selectedType, onSelectType }) => {
  const sections = useMemo(() => {
    const sectionOrder = ['issues', 'documents', 'tasks'];
    return sectionOrder
      .map(subTypeKey => {
        const subType = CONNECTION_SUB_TYPE_MAP[subTypeKey];
        if (!subType) return null;
        const items = availableConnectionTypes.filter(connection => {
          const connectionSubType = connection.sub_types || connection.subTypes;
          const connectionSubTypeName = connectionSubType?.name;
          return connectionSubTypeName === subType.name || connectionSubTypeName === subTypeKey;
        });
        return items.length > 0 ? { key: subTypeKey, title: subType.text, items } : null;
      })
      .filter(Boolean);
  }, [availableConnectionTypes]);

  const [collapsedSections, setCollapsedSections] = useState([]);

  useEffect(() => {
    setCollapsedSections(prev => prev.filter(sectionKey => sections.some(section => section.key === sectionKey)));
  }, [sections]);

  const toggleConnectionSection = useCallback((sectionKey) => {
    setCollapsedSections(prev => {
      if (prev.includes(sectionKey)) {
        return prev.filter(key => key !== sectionKey);
      }
      return [...prev, sectionKey];
    });
  }, []);

  return (
    <div className="seaqa-project-new-connection-type-sections">
      {sections.map(section => {
        const isCollapsed = collapsedSections.includes(section.key);
        return (
          <div key={section.key} className="seaqa-project-new-connection-section">
            <div className="seaqa-project-new-connection-section-header">
              <div className="seaqa-project-new-connection-section-title">{section.title}</div>
              <IconButton
                icon="arrow-down-b"
                className={classnames('seaqa-project-new-connection-section-toggle', { 'rotate-icon-90': isCollapsed })}
                iconClassName="seaqa-project-new-connection-section-toggle-icon"
                role="button"
                tabIndex={0}
                aria-expanded={!isCollapsed}
                aria-label={isCollapsed ? gettext('Expand section') : gettext('Collapse section')}
                onClick={() => toggleConnectionSection(section.key)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleConnectionSection(section.key);
                  }
                }}
              />
            </div>
            {!isCollapsed && (
              <div className="seaqa-project-new-connection-grid">
                {section.items.map(connection => {
                  const { type, name } = connection;
                  const isActive = type === selectedType;
                  return (
                    <button
                      type="button"
                      key={type}
                      onClick={() => onSelectType(type)}
                      className={classnames('seaqa-project-new-connection-card', { selected: isActive })}
                    >
                      <span className="seaqa-project-new-connection-card-icon-wrap">
                        <img src={getConnectionIcon(type)} alt={name} className="seaqa-project-new-connection-card-icon" />
                      </span>
                      <span className="seaqa-project-new-connection-card-name">{name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

ConnectionTypeSections.propTypes = {
  availableConnectionTypes: PropTypes.array.isRequired,
  selectedType: PropTypes.string.isRequired,
  onSelectType: PropTypes.func.isRequired,
};

export default ConnectionTypeSections;
