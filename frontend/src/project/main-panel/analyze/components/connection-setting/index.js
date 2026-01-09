import React, { useState, useEffect, useCallback, useRef } from 'react';
import { gettext } from '@/constants';
import { Icon, IconTooltip, toaster } from '@/components';
import CustomizePopover from '@/components/customize-popover';
import { connectionsAPI } from '@/project/api';
import { getConnectionIcon } from '@/project/main-panel/connections/utils';

import './index.css';

const { projectUuid } = window.app.pageOptions;

const ConnectionSetting = ({ selectedConnections, onConnectionsChange, onRemoveConnection }) => {
  const [connections, setConnections] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [tempSelectedConnections, setTempSelectedConnections] = useState([]);
  const dropdownRef = useRef(null);

  const closeDropdown = useCallback(() => {
    if (!isDropdownOpen) return;

    const currentIds = [...selectedConnections.map(c => c.id)].sort();
    const tempIds = [...tempSelectedConnections.map(c => c.id)].sort();
    const hasChanged = currentIds.length !== tempIds.length || currentIds.some((id, index) => id !== tempIds[index]);
    if (hasChanged) {
      onConnectionsChange(tempSelectedConnections);
    }
    setIsDropdownOpen(false);
  }, [isDropdownOpen, selectedConnections, tempSelectedConnections, onConnectionsChange]);

  const loadConnections = useCallback(async () => {
    try {
      const res = await connectionsAPI.listConnections(projectUuid, 1, 1000);
      const allConnections = res.data.records || [];
      setConnections(allConnections);
    } catch (error) {
      toaster.danger(gettext('Failed to load connections'));
    }
  }, []);

  const handleToggleDropdown = useCallback(() => {
    if (!isDropdownOpen) {
      setTempSelectedConnections(selectedConnections);
      setIsDropdownOpen(true);
    } else {
      closeDropdown();
    }
  }, [isDropdownOpen, selectedConnections, closeDropdown]);

  const handleToggleConnection = useCallback((connection) => {
    const isSelected = tempSelectedConnections.some(c => c.id === connection.id);
    if (isSelected) {
      setTempSelectedConnections(tempSelectedConnections.filter(c => c.id !== connection.id));
    } else {
      setTempSelectedConnections([...tempSelectedConnections, connection]);
    }
  }, [tempSelectedConnections]);

  useEffect(() => {
    loadConnections();
  }, []);

  return (
    <div className="analyze-settings-section">
      <div className="analyze-settings-label">{gettext('Connection')}</div>
      {selectedConnections.length > 0 && (
        <div className="analyze-selected-connections">
          {selectedConnections.map(connection => (
            <div key={connection.id} className="analyze-connection-tag">
              <img src={getConnectionIcon(connection.type)} alt="" className="analyze-tag-icon" />
              <span className="analyze-tag-name">{connection.name}</span>
              <IconTooltip
                icon="close"
                className="analyze-tag-remove"
                tip={gettext('Remove')}
                placement="bottom"
                onClick={() => onRemoveConnection(connection.id)}
              />
            </div>
          ))}
        </div>
      )}
      <div className="analyze-add-connection" ref={dropdownRef}>
        <div className="analyze-add-btn" onClick={handleToggleDropdown}>
          <Icon symbol="plus" className="analyze-add-icon" />
          <span>{gettext('Add connections')}</span>
        </div>
        {isDropdownOpen && (
          <CustomizePopover
            target={dropdownRef}
            className="analyze-connection-dropdown-popover"
            hidePopover={closeDropdown}
            hidePopoverWithEsc={closeDropdown}
            modifiers={[
              { name: 'preventOverflow', options: { boundary: document.body } },
              { name: 'offset', options: { offset: [0, 0] } }
            ]}
          >
            <div className="analyze-connection-dropdown">
              {connections.length === 0 && (
                <div className="tip-default analyze-dropdown-empty">{gettext('No available connections')}</div>
              )}
              {connections.length > 0 && (
                <>
                  {connections.map(connection => {
                    const isSelected = tempSelectedConnections.some(c => c.id === connection.id);
                    return (
                      <div key={connection.id} className="analyze-dropdown-item" onClick={() => handleToggleConnection(connection)}>
                        <div className="analyze-connection-icon">
                          <Icon symbol={isSelected ? 'check-mark' : ''} className="no-hover-bg" />
                        </div>
                        <img src={getConnectionIcon(connection.type)} alt="" className="analyze-connection-img" />
                        <span className="analyze-connection-name">{connection.name}</span>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </CustomizePopover>
        )}
      </div>
    </div>
  );
};

export default ConnectionSetting;
