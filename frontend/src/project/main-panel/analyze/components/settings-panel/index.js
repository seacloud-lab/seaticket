import React, { useMemo } from 'react';
import { gettext } from '@/constants';
import { IconButton, Loading, CustomizeSelect } from '@/components';
import YearRangePicker from '../year-range-picker';
import ConnectionSetting from '../connection-setting';
import { FormGroup, Label } from 'reactstrap';

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
  const colorOptions = useMemo(() => {
    return [
      { value: '', label: '--' },
      { value: 'connection_id', label: gettext('Connection') },
      { value: 'state', label: gettext('State') },
    ];
  }, []);

  const displayColorOption = useMemo(() => {
    return colorOptions.find(o => o.value === colorBy) || colorOptions[0];
  }, [colorBy, colorOptions]);

  const modeOptions = useMemo(() => {
    return [
      { value: 'density', label: gettext('Density') },
      { value: 'points', label: gettext('Points') },
    ];
  }, []);

  const displayModeOption = useMemo(() => {
    return modeOptions.find(o => o.value === displayMode) || modeOptions[0];
  }, [displayMode, modeOptions]);

  return (
    <div className="analyze-settings-panel">
      <div className="analyze-settings-header">
        <span className="analyze-settings-title">{gettext('Settings')}</span>
        <IconButton icon="close" onClick={onClose} className="analyze-settings-close" />
      </div>
      <div className="analyze-settings-body">
        {/* Add connections Setting */}
        <FormGroup className="analyze-settings-section">
          <Label>{gettext('Connections')}</Label>
          <ConnectionSetting
            selectedConnections={selectedConnections}
            onConnectionsChange={onConnectionsChange}
            onRemoveConnection={onRemoveConnection}
          />
        </FormGroup>
        {/* Date Range Setting */}
        <FormGroup className="analyze-settings-section">
          <Label>{gettext('Date range')}</Label>
          <YearRangePicker
            startYear={startYear}
            endYear={endYear}
            onChange={onDateRangeChange}
          />
        </FormGroup>
        {/* Color Setting */}
        <FormGroup className="analyze-settings-section">
          <Label>{gettext('Color')}</Label>
          <CustomizeSelect
            className="analyze-settings-select"
            isInModal={true}
            value={displayColorOption}
            options={colorOptions}
            onChange={onColorByChange}
          />
        </FormGroup>
        {/* Mode Setting */}
        <FormGroup className="analyze-settings-section">
          <Label>{gettext('Display Mode')}</Label>
          <CustomizeSelect
            className="analyze-settings-select"
            isInModal={true}
            value={displayModeOption}
            options={modeOptions}
            onChange={onDisplayModeChange}
          />
        </FormGroup>
      </div>
      <div className="p-4">
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
