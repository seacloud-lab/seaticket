import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { defaultCategoryColors } from 'embedding-atlas/react';
import { gettext } from '@/constants';
import { Loading, IconButton } from '@/components';
import { connectionsAPI } from '@/project/api';
import TopBar from '../top-bar';
import SettingsPanel from './components/settings-panel';
import Legend from './components/legend';
import EmbeddingView from './components/embedding-view';
import { STORAGE_KEY, projectUuid } from './constants';

import './index.css';

const Analyze = ({ title }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [embeddingData, setEmbeddingData] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedConnections, setSelectedConnections] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [colorBy, setColorBy] = useState('--');
  const [displayMode, setDisplayMode] = useState('points');
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
      const connectionsToSave = selectedConnections.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(connectionsToSave));
    } catch (e) {
      console.error('Failed to save connections to localStorage:', e);
    }
  }, [selectedConnections]);

  const loadEmbeddingData = useCallback(async (connectionIds) => {
    if (!connectionIds || connectionIds.length === 0) {
      setEmbeddingData(null);
      setMetadata(null);
      return;
    }

    setIsLoading(true);
    setSelectedCategories([]);

    try {
      const response = await connectionsAPI.getConnectionsEmbeddingAnalysis(projectUuid, connectionIds);
      const { task_id } = response.data;

      const records = await pollTaskStatus(task_id);
      processBackendData(records);
    } catch (error) {
      console.error('Failed to load embedding data:', error);
      setIsLoading(false);
      setEmbeddingData(null);
      setMetadata({
        error: true,
        errorMessage: error.response?.data?.error_msg || 'Failed to load data'
      });
    }
  }, []);

  const pollTaskStatus = (taskId) => {
    return new Promise((resolve, reject) => {
      const poll = () => {
        connectionsAPI.getEmbeddingAnalysisTaskStatus(taskId)
          .then(statusResponse => {
            const { is_finished, records } = statusResponse.data;
            if (is_finished) {
              resolve(records);
            } else {
              setTimeout(poll, 2000);
            }
          })
          .catch(reject);
      };
      poll();
    });
  };

  const processBackendData = (records) => {
    if (!records || records.length === 0) {
      setIsLoading(false);
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
      setIsLoading(false);
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
        id: record.id || record._id || `record_${index}`,
        x: xArray[index],
        y: yArray[index],
        title: record.ai_summary,
        ...record
      });
    });

    setEmbeddingData({ x: xArray, y: yArray });
    setMetadata({ records: dataPoints });
    setIsLoading(false);
  };

  useEffect(() => {
    if (selectedConnections.length > 0) {
      const timer = setTimeout(() => {
        loadEmbeddingData(selectedConnections.map(c => c.id));
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setEmbeddingData(null);
      setMetadata(null);
    }
  }, [selectedConnections, loadEmbeddingData]);

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
      return { embeddingData, categoryData: baseCategoryData };
    }

    if (selectedCategories.length === 0) {
      return { embeddingData, categoryData: baseCategoryData };
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

    for (let i = 0; i < selectedIndices.length; i++) {
      const originalIndex = selectedIndices[i];
      filteredX[i] = embeddingData.x[originalIndex];
      filteredY[i] = embeddingData.y[originalIndex];
      filteredCategories[i] = baseCategoryData.originalCategories[originalIndex];
    }

    return {
      embeddingData: { x: filteredX, y: filteredY },
      categoryData: {
        ...baseCategoryData,
        categories: filteredCategories
      }
    };
  }, [embeddingData, baseCategoryData, selectedCategories]);

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

  const renderContent = () => {
    if (selectedConnections.length === 0) {
      return (
        <div className="analyze-empty-state">
          <div className="analyze-empty-icon">
            <i className="sf3-font sf3-font-chart" style={{ fontSize: '48px', color: '#999' }}></i>
          </div>
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
      return null;
    }

    const { embeddingData: displayData, categoryData } = filteredData;

    const useCategory = !!colorBy;

    return (
      <div className="embedding-visualization-container">
        <EmbeddingView
          embeddingData={displayData}
          categoryData={categoryData}
          metadata={metadata}
          useCategory={useCategory}
          displayMode={displayMode}
          width={dimensions.width}
          height={dimensions.height}
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
          icon="settings"
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
          />
        )}
      </div>
    </>
  );
};

export default Analyze;
