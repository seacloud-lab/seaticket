import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { defaultCategoryColors } from 'embedding-atlas/react';
import { gettext } from '@/constants';
import { Loading, IconButton } from '@/components';
import TopBar from '../top-bar';
import SettingsPanel from './components/settings-panel';
import Legend from './components/legend';
import EmbeddingView from './components/embedding-view';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import { useAnalyzeTask } from './hooks/analyze-task';
import { SETTINGS_STORAGE_KEY, projectUuid } from './constants';

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
  const { isLoading, records, error, startAnalysis, resetAnalysis } = useAnalyzeTask();
  const [embeddingData, setEmbeddingData] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

  const storedSettings = getStoredSettings();
  const [selectedConnections, setSelectedConnections] = useState(storedSettings.connections || []);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [colorBy, setColorBy] = useState(storedSettings.colorBy || '--');
  const [displayMode, setDisplayMode] = useState(storedSettings.displayMode || 'points');
  const [startYear, setStartYear] = useState(storedSettings.startYear || null);
  const [endYear, setEndYear] = useState(storedSettings.endYear || null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const handleColorByChange = useCallback((newColorBy) => {
    setColorBy(newColorBy);
    setSelectedCategories([]);
  }, []);

  const updateDimensions = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDimensions({
        width: rect.width,
        height: rect.height
      });
    }
  }, []);

  useEffect(() => {
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [updateDimensions]);

  useEffect(() => {
    const timer = setTimeout(updateDimensions, 0);
    return () => clearTimeout(timer);
  }, [isSettingsOpen, updateDimensions]);

  useEffect(() => {
    try {
      const settings = {
        connections: selectedConnections.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type
        })),
        colorBy,
        displayMode,
        startYear,
        endYear
      };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings to localStorage:', e);
    }
  }, [selectedConnections, colorBy, displayMode, startYear, endYear]);

  useEffect(() => {
    if (records) {
      processBackendData(records);
    }
  }, [records]);

  useEffect(() => {
    if (error) {
      setEmbeddingData(null);
      setMetadata({
        error: true,
        errorMessage: error.message || 'Failed to load data'
      });
    }
  }, [error]);

  const processBackendData = (records) => {
    if (!records || records.length === 0) {
      setEmbeddingData(null);
      setMetadata({
        error: true,
        errorMessage: gettext('No data for analysis')
      });
      return;
    }

    const validRecords = records.filter(record =>
      record.x != null &&
      record.y != null &&
      !isNaN(parseFloat(record.x)) &&
      !isNaN(parseFloat(record.y))
    );

    if (validRecords.length === 0) {
      setEmbeddingData(null);
      setMetadata({
        error: true,
        errorMessage: gettext('No valid coordinates found in data')
      });
      return;
    }

    const dataPoints = [];
    const xArray = new Float32Array(validRecords.length);
    const yArray = new Float32Array(validRecords.length);

    validRecords.forEach((record, index) => {
      xArray[index] = parseFloat(record.x);
      yArray[index] = parseFloat(record.y);

      dataPoints.push({
        id: `record_${index}`,
        x: xArray[index],
        y: yArray[index],
        ...record
      });
    });

    setEmbeddingData({ x: xArray, y: yArray });
    setMetadata({ records: dataPoints });
    setSelectedCategories([]);
  };

  useEffect(() => {
    if (selectedConnections.length === 0) {
      setEmbeddingData(null);
      setMetadata(null);
      resetAnalysis();
    }
  }, [selectedConnections, resetAnalysis]);

  const handleAnalyze = useCallback(() => {
    if (selectedConnections.length > 0) {
      startAnalysis(selectedConnections.map(c => c.id), startYear, endYear);
    }
  }, [selectedConnections, startYear, endYear, startAnalysis]);

  const createCategoryMapping = (records, colorByField) => {
    if (!records || records.length === 0) return null;

    if (!colorByField || !records[0].hasOwnProperty(colorByField)) {
      return null;
    }

    const values = records.map(r => r[colorByField]);
    const uniqueValues = [...new Set(values.filter(v => v != null))];

    return createDiscreteMapping(values, uniqueValues, colorByField);
  };

  const createDiscreteMapping = (values, uniqueValues, colorByField) => {
    const counts = {};
    values.forEach(v => {
      const key = v == null ? '__NULL__' : String(v);
      counts[key] = (counts[key] || 0) + 1;
    });

    const sortedValues = uniqueValues
      .sort((a, b) => counts[String(b)] - counts[String(a)]);

    const valueToIndex = new Map();
    sortedValues.forEach((v, i) => valueToIndex.set(v, i));

    const NULL_INDEX = sortedValues.length;

    const categories = new Uint8Array(values.length);
    values.forEach((v, i) => {
      if (v == null) {
        categories[i] = NULL_INDEX;
      } else {
        categories[i] = valueToIndex.get(v);
      }
    });

    const categoryCount = sortedValues.length + (values.some(v => v == null) ? 1 : 0);
    const colors = defaultCategoryColors(categoryCount);

    const legend = sortedValues.map((v, i) => {
      let label;
      if (colorByField === 'connection_id') {
        const connection = selectedConnections.find(c => String(c.id) === String(v));
        label = connection ? connection.name : String(v);
      } else {
        label = String(v);
      }
      return {
        label,
        color: colors[i],
        count: counts[String(v)],
        categoryIndex: i
      };
    });

    const nullCount = values.filter(v => v == null).length;
    if (nullCount > 0) {
      legend.push({
        label: '(null)',
        color: colors[NULL_INDEX],
        count: nullCount,
        categoryIndex: NULL_INDEX
      });
    }

    return { categories, colors, legend, originalCategories: categories.slice() };
  };

  const baseCategoryData = useMemo(() => {
    if (!metadata?.records) {
      return null;
    }
    return createCategoryMapping(metadata.records, colorBy);
  }, [metadata, selectedConnections, colorBy]);

  const filteredData = useMemo(() => {
    if (!embeddingData || !baseCategoryData) {
      return { embeddingData, categoryData: baseCategoryData, metadata };
    }

    if (selectedCategories.length === 0) {
      return { embeddingData, categoryData: baseCategoryData, metadata };
    }

    const selectedIndices = [];
    for (let i = 0; i < baseCategoryData.originalCategories.length; i++) {
      if (selectedCategories.includes(baseCategoryData.originalCategories[i])) {
        selectedIndices.push(i);
      }
    }

    const filteredX = new Float32Array(selectedIndices.length);
    const filteredY = new Float32Array(selectedIndices.length);
    const filteredCategories = new Uint8Array(selectedIndices.length);
    const filteredRecords = [];

    for (let i = 0; i < selectedIndices.length; i++) {
      const originalIndex = selectedIndices[i];
      filteredX[i] = embeddingData.x[originalIndex];
      filteredY[i] = embeddingData.y[originalIndex];
      filteredCategories[i] = baseCategoryData.originalCategories[originalIndex];
      filteredRecords.push(metadata.records[originalIndex]);
    }

    return {
      embeddingData: { x: filteredX, y: filteredY },
      categoryData: {
        ...baseCategoryData,
        categories: filteredCategories
      },
      metadata: { records: filteredRecords }
    };
  }, [embeddingData, baseCategoryData, selectedCategories, metadata]);

  const handleLegendItemClick = (categoryIndex, event) => {
    if (event.shiftKey || event.metaKey) {
      setSelectedCategories(prev => {
        if (prev.includes(categoryIndex)) {
          return prev.filter(i => i !== categoryIndex);
        } else {
          return [...prev, categoryIndex];
        }
      });
    } else {
      setSelectedCategories(prev => {
        if (prev.length === 1 && prev[0] === categoryIndex) {
          return [];
        } else {
          return [categoryIndex];
        }
      });
    }
  };

  const handleToggleSettings = useCallback(() => {
    setIsSettingsOpen(prev => !prev);
  }, []);

  const handleConnectionsChange = useCallback((connections) => {
    setSelectedConnections(connections);
  }, []);

  const handleRemoveConnection = useCallback((connectionId) => {
    setSelectedConnections(prev => prev.filter(c => c.id !== connectionId));
  }, []);

  const handleDateRangeChange = useCallback((newStartYear, newEndYear) => {
    setStartYear(newStartYear);
    setEndYear(newEndYear);
  }, []);

  const handlePointClick = useCallback((record) => {
    if (record) {
      setSelectedRecord({
        _id: record._pk,
        type: record?.connection_type,
        connection_id: record?.connection_id ? Number(record?.connection_id) : record?.connection_id,
        title: record.title,
        path: record.path,
        filename: record.filename,
        url: record.url,
        slug: record.slug,
        topic_id: record?.topic_id,
      });
      setIsDetailsDialogOpen(true);
    }
  }, []);

  const handleCloseDetailsDialog = useCallback(() => {
    setIsDetailsDialogOpen(false);
    setSelectedRecord(null);
  }, []);

  const renderContent = () => {
    if (selectedConnections.length === 0) {
      return (
        <div className="analyze-empty-state">
          <p className="analyze-empty-text">{gettext('Select connections to analyze')}</p>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="d-flex justify-content-center align-items-center h-100">
          <Loading />
        </div>
      );
    }

    if (metadata?.error) {
      return (
        <div className="d-flex justify-content-center align-items-center h-100">
          <div className="text-center">
            <i className="fas fa-exclamation-triangle text-warning" style={{ fontSize: '3rem' }}></i>
            <p className="text-muted mt-3">{metadata.errorMessage || gettext('No valid data available')}</p>
          </div>
        </div>
      );
    }

    if (!embeddingData) {
      return (
        <div className="analyze-empty-state">
          <p className="analyze-empty-text">{gettext('Click Analyze to start')}</p>
        </div>
      );
    }

    const { embeddingData: displayData, categoryData, metadata: displayMetadata } = filteredData;

    const useCategory = !!colorBy;

    return (
      <div className="embedding-visualization-container">
        <EmbeddingView
          embeddingData={displayData}
          categoryData={categoryData}
          metadata={displayMetadata}
          useCategory={useCategory}
          displayMode={displayMode}
          width={dimensions.width}
          height={dimensions.height}
          onPointClick={handlePointClick}
        />

        {useCategory && baseCategoryData?.legend && (
          <Legend
            items={baseCategoryData.legend}
            selectedCategories={selectedCategories}
            onItemClick={handleLegendItemClick}
          />
        )}
      </div>
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
        <div className="analyze-main-content" ref={containerRef}>
          {renderContent()}
        </div>
        {isSettingsOpen && (
          <SettingsPanel
            selectedConnections={selectedConnections}
            onConnectionsChange={handleConnectionsChange}
            onRemoveConnection={handleRemoveConnection}
            onClose={handleToggleSettings}
            colorBy={colorBy}
            onColorByChange={handleColorByChange}
            displayMode={displayMode}
            onDisplayModeChange={setDisplayMode}
            startYear={startYear}
            endYear={endYear}
            onDateRangeChange={handleDateRangeChange}
            onAnalyze={handleAnalyze}
            isLoading={isLoading}
          />
        )}
      </div>
      {isDetailsDialogOpen && selectedRecord && (
        <ResourceDetailsDialog
          projectUuid={projectUuid}
          resource={selectedRecord}
          isShowIcon={true}
          onToggle={handleCloseDetailsDialog}
        />
      )}
    </>
  );
};

export default Analyze;
