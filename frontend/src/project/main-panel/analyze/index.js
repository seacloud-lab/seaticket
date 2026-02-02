import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { gettext } from '@/constants';
import { IconButton, CenteredLoading, CenteredError } from '@/components';
import TopBar from '../top-bar';
import SettingsPanel from './components/settings-panel';
import EmbeddingView from './components/embedding-view';
import { useAnalyzeTask } from './hooks/analyze-task';
import { SETTINGS_STORAGE_KEY } from './constants';

import './index.css';

const getStoredSettings = () => {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const Analyze = ({ title }) => {
  const { isLoading, records, lastLoadRecordsTime, error, startAnalysis } = useAnalyzeTask();

  // settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [selectedConnections, setSelectedConnections] = useState([]);
  const [colorBy, setColorBy] = useState( '--');
  const [displayMode, setDisplayMode] = useState('points');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [filters, setFilters] = useState([]);

  const handleColorByChange = useCallback((newColorBy) => {
    setColorBy(newColorBy);
  }, []);

  useEffect(() => {
    const storedSettings = getStoredSettings();
    setSelectedConnections(storedSettings.connections || []);
    setColorBy(storedSettings.colorBy || '--');
    setDisplayMode(storedSettings.displayMode || 'points');
    setStartDate(storedSettings.startDate || null);
    setEndDate(storedSettings.endDate || null);
    setFilters(storedSettings.filters || []);
  }, []);

  useEffect(() => {
    try {
      const storedSettings = getStoredSettings();
      const settings = {
        ...storedSettings,
        colorBy,
        displayMode,
        startDate,
        endDate,
        filters
      };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings to localStorage:', e);
    }
  }, [colorBy, displayMode, startDate, endDate, filters]);

  const handleAnalyze = useCallback(() => {
    startAnalysis(selectedConnections.map(c => c.id), startDate, endDate);
    const storedSettings = getStoredSettings();
    const newSettings = {
      ...storedSettings,
      connections: selectedConnections.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type
      })),
    };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
  }, [selectedConnections, startDate, endDate, startAnalysis]);

  const FILTERABLE_FIELDS = useMemo(() => [
    { field: 'state', label: gettext('State') }
  ], []);

  const filterableFieldOptions = useMemo(() => {
    if (!records || records.length === 0) {
      return {};
    }
    const options = {};
    FILTERABLE_FIELDS.forEach(({ field }) => {
      const values = records.map(r => r[field]);
      const uniqueValues = [...new Set(values.filter(v => v != null))].sort();
      if (uniqueValues.length > 0) {
        options[field] = uniqueValues;
      }
    });
    return options;
  }, [records, FILTERABLE_FIELDS]);

  const handleToggleSettings = useCallback(() => {
    setIsSettingsOpen(prev => !prev);
  }, []);

  const handleConnectionsChange = useCallback((connections) => {
    setSelectedConnections(connections);
  }, []);

  const handleRemoveConnection = useCallback((connectionId) => {
    setSelectedConnections(prev => prev.filter(c => c.id !== connectionId));
  }, []);

  const handleDateRangeChange = useCallback(({ from, to }) => {
    const newStart = from ? from.format('YYYY-MM-DD') : null;
    const newEnd = to ? to.format('YYYY-MM-DD') : null;
    setStartDate(newStart);
    setEndDate(newEnd);
  }, []);

  const handleAddFilter = useCallback((field, value) => {
    setFilters(prev => {
      const existingIndex = prev.findIndex(f => f.field === field);
      if (existingIndex >= 0) {
        const newFilters = [...prev];
        newFilters[existingIndex] = { field, value };
        return newFilters;
      }
      return [...prev, { field, value }];
    });
  }, []);

  const handleRemoveFilter = useCallback((field) => {
    setFilters(prev => prev.filter(f => f.field !== field));
  }, []);

  const renderContent = () => {
    if (isLoading) {
      return (<CenteredLoading />);
    }

    if (error) {
      return (<CenteredError>{error.message}</CenteredError>);
    }

    if (!records && selectedConnections.length === 0) {
      return (
        <div className="analyze-empty-state">
          <p className="analyze-empty-text">{gettext('Select connections to analyze')}</p>
        </div>
      );
    }

    return (
      <EmbeddingView
        colorBy={colorBy}
        filters={filters}
        displayMode={displayMode}
        records={records}
        connections={selectedConnections}
        lastLoadRecordsTime={lastLoadRecordsTime}
      />
    );
  };

  return (
    <>
      <TopBar>
        <div className="w-100 text-truncate">{title}</div>
        <IconButton
          icon="set-up"
          onClick={handleToggleSettings}
        />
      </TopBar>
      <div className="sea-qa-project-analyze">
        <div className="analyze-main-content">
          {renderContent()}
        </div>
        {isSettingsOpen && (
          <SettingsPanel
            selectedConnections={selectedConnections}
            onConnectionsChange={handleConnectionsChange}
            onRemoveConnection={handleRemoveConnection}
            onClose={handleToggleSettings}
            filters={filters}
            filterableFieldOptions={filterableFieldOptions}
            onAddFilter={handleAddFilter}
            onRemoveFilter={handleRemoveFilter}
            colorBy={colorBy}
            onColorByChange={handleColorByChange}
            displayMode={displayMode}
            onDisplayModeChange={setDisplayMode}
            startDate={startDate}
            endDate={endDate}
            onDateRangeChange={handleDateRangeChange}
            onAnalyze={handleAnalyze}
            isLoading={isLoading}
          />
        )}
      </div>
    </>
  );
};

export default Analyze;
