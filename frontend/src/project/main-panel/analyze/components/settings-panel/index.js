import React from 'react';
import { gettext } from '@/constants';
import { IconButton, Loading } from '@/components';
import YearRangePicker from '../year-range-picker';
import ConnectionSetting from '../connection-setting';

import './index.css';

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
  return (
    <div className="analyze-settings-panel">
      <div className="analyze-settings-header">
        <span className="analyze-settings-title">{gettext('Settings')}</span>
        <IconButton icon="close" onClick={onClose} className="analyze-settings-close" />
      </div>
      <div className="analyze-settings-body">
        {/* Add connections Setting */}
        <div className="analyze-settings-section">
          <div className="analyze-settings-label">{gettext('Connections')}</div>
          <ConnectionSetting
            selectedConnections={selectedConnections}
            onConnectionsChange={onConnectionsChange}
            onRemoveConnection={onRemoveConnection}
          />
        </div>
        {/* Date Range Setting */}
        <div className="analyze-settings-section">
          <div className="analyze-settings-label">{gettext('Date range')}</div>
          <YearRangePicker
            startYear={startYear}
            endYear={endYear}
            onChange={onDateRangeChange}
          />
        </div>
        {/* Color Setting */}
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
        {/* Mode Setting */}
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
