import React, { useState, useEffect, useCallback, useRef } from 'react';
import { gettext } from '@/constants';
import { Icon, IconButton, IconTooltip, toaster, Loading } from '@/components';
import { connectionsAPI } from '@/project/api';
import { getConnectionIcon } from '../../../connections/utils';
import YearRangePicker from '../year-range-picker';

import './index.css';

const { projectUuid } = window.app.pageOptions;

const SettingsPanel = ({
  selectedConnections,
  onConnectionsChange,
  onRemoveConnection,
  onClose,
  colorBy,
  onColorByChange,
  displayMode,
  onDisplayModeChange,
  startYear,
  endYear,
  onDateRangeChange,
  onAnalyze,
  isLoading
}) => {
  const [connections, setConnections] = useState([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [tempSelectedConnections, setTempSelectedConnections] = useState([]);
  const dropdownRef = useRef(null);

  useEffect(() => {
    loadConnections();
  }, []);

  const closeDropdown = useCallback(() => {
    if (!isDropdownOpen) return;

    const currentIds = [...selectedConnections.map(c => c.id)].sort();
    const tempIds = [...tempSelectedConnections.map(c => c.id)].sort();
    const hasChanged = currentIds.length !== tempIds.length ||
      currentIds.some((id, index) => id !== tempIds[index]);

    if (hasChanged) {
      onConnectionsChange(tempSelectedConnections);
    }
    setIsDropdownOpen(false);
  }, [isDropdownOpen, selectedConnections, tempSelectedConnections, onConnectionsChange]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        closeDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeDropdown]);

  const loadConnections = useCallback(async () => {
    setIsLoadingConnections(true);
    try {
      const res = await connectionsAPI.listConnections(projectUuid, 1, 1000);
      const allConnections = res.data.records || [];
      setConnections(allConnections);
    } catch (error) {
      console.error('Failed to load connections:', error);
      toaster.danger(gettext('Failed to load connections'));
    } finally {
      setIsLoadingConnections(false);
    }
  }, []);

  const handleToggleDropdown = useCallback(() => {
    if (!isDropdownOpen) {
      setTempSelectedConnections(selectedConnections);
    } else {
      closeDropdown();
      return;
    }
    setIsDropdownOpen(true);
  }, [isDropdownOpen, selectedConnections, closeDropdown]);

  const handleToggleConnection = useCallback((connection) => {
    const isSelected = tempSelectedConnections.some(c => c.id === connection.id);
    if (isSelected) {
      setTempSelectedConnections(tempSelectedConnections.filter(c => c.id !== connection.id));
    } else {
      setTempSelectedConnections([...tempSelectedConnections, connection]);
    }
  }, [tempSelectedConnections]);

  return (
    <div className="analyze-settings-panel">
      <div className="analyze-settings-header">
        <span className="analyze-settings-title">{gettext('Settings')}</span>
        <IconButton icon="close" onClick={onClose} className="analyze-settings-close" />
      </div>
      <div className="analyze-settings-body">
        <div className="analyze-settings-section">
          <div className="analyze-settings-label">{gettext('Connection')}</div>

          <div className="analyze-selected-connections">
            {selectedConnections.length === 0 ? (
              <div className="analyze-no-connections">{gettext('No connections selected')}</div>
            ) : (
              selectedConnections.map(connection => (
                <div key={connection.id} className="analyze-connection-tag">
                  <img
                    src={getConnectionIcon(connection.type)}
                    alt=""
                    className="analyze-tag-icon"
                  />
                  <span className="analyze-tag-name">{connection.name}</span>
                  <IconTooltip
                    icon="close"
                    className="analyze-tag-remove"
                    tip={gettext('Remove')}
                    placement="bottom"
                    onClick={() => onRemoveConnection(connection.id)}
                  />
                </div>
              ))
            )}
          </div>

          <div className="analyze-add-connection" ref={dropdownRef}>
            <div className="analyze-add-btn" onClick={handleToggleDropdown}>
              <Icon symbol="plus" className="analyze-add-icon" />
              <span>{gettext('Add connections')}</span>
            </div>

            {isDropdownOpen && (
              <div className="analyze-connection-dropdown">
                {isLoadingConnections ? (
                  <div className="analyze-dropdown-loading">{gettext('Loading...')}</div>
                ) : connections.length === 0 ? (
                  <div className="analyze-dropdown-empty">{gettext('No available connections')}</div>
                ) : (
                  connections.map(connection => {
                    const isSelected = tempSelectedConnections.some(c => c.id === connection.id);
                    return (
                      <div
                        key={connection.id}
                        className="analyze-dropdown-item"
                        onClick={() => handleToggleConnection(connection)}
                      >
                        <IconButton icon={isSelected ? 'check-mark' : ''} className="no-hover-bg" />
                        <img
                          src={getConnectionIcon(connection.type)}
                          alt=""
                          className="analyze-connection-icon"
                        />
                        <span className="analyze-connection-name">{connection.name}</span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        <div className="analyze-settings-section">
          <div className="analyze-settings-label">{gettext('Date range')}</div>
          <YearRangePicker
            startYear={startYear}
            endYear={endYear}
            onChange={onDateRangeChange}
          />
        </div>

        <div className="analyze-settings-section">
          <div className="analyze-settings-row">
            <span className="analyze-settings-label">{gettext('Color')}</span>
            <select
              className="analyze-settings-select"
              value={colorBy || ''}
              onChange={(e) => onColorByChange(e.target.value || null)}
            >
              <option value="">{gettext('--')}</option>
              <option value="connection_id">{gettext('Connection')}</option>
              <option value="state">{gettext('State')}</option>
            </select>
          </div>
        </div>

        <div className="analyze-settings-section">
          <div className="analyze-settings-row">
            <span className="analyze-settings-label">{gettext('Display Mode')}</span>
            <select
              className="analyze-settings-select"
              value={displayMode}
              onChange={(e) => onDisplayModeChange(e.target.value)}
            >
              <option value="density">{gettext('Density')}</option>
              <option value="points">{gettext('Points')}</option>
            </select>
          </div>
        </div>
      </div>
      <div className="analyze-settings-footer">
        <button
          className="analyze-btn"
          onClick={onAnalyze}
          disabled={isLoading || selectedConnections.length === 0}
        >
          {isLoading && <Loading />}
          <span>{isLoading ? gettext('Analyzing') : gettext('Analyze')}</span>
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;
