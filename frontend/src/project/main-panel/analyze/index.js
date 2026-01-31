import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { defaultCategoryColors } from 'embedding-atlas/react';
import { Coordinator, wasmConnector, Selection } from '@uwdata/mosaic-core';
import * as SQL from '@uwdata/mosaic-sql';
import { gettext } from '@/constants';
import { Loading, IconButton } from '@/components';
import TopBar from '../top-bar';
import SettingsPanel from './components/settings-panel';
import Legend from './components/legend';
import EmbeddingView from './components/embedding-view';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import { useAnalyzeTask } from './hooks/analyze-task';
import { TABLE_SCHEMA, SETTINGS_STORAGE_KEY, projectUuid, COLOR_BY_FIELDS } from './constants';

import './index.css';

// Global singleton for Mosaic coordinator and DuckDB WASM connector
let globalCoordinator = null;
let globalConnector = null;

// Module-level cache to persist data across component unmounts
let cachedTableName = null;
let cachedTableSchema = null;
let cachedCategoryMappings = {};

const getCoordinator = async () => {
  if (!globalCoordinator) {
    globalConnector = wasmConnector();
    globalCoordinator = new Coordinator(globalConnector);
  }
  return globalCoordinator;
};

const getConnector = async () => {
  if (!globalConnector) {
    await getCoordinator();
  }
  return globalConnector;
};

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
  const [mosaicCoordinator, setMosaicCoordinator] = useState(null);
  const [tableName, setTableName] = useState(cachedTableName);
  const [tableSchema, setTableSchema] = useState(cachedTableSchema);
  const [categoryMappings, setCategoryMappings] = useState(cachedCategoryMappings);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isProcessingData, setIsProcessingData] = useState(false);
  const [filterSelection, setFilterSelection] = useState(null);

  const storedSettings = getStoredSettings();
  const [selectedConnections, setSelectedConnections] = useState(storedSettings.connections || []);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [colorBy, setColorBy] = useState(storedSettings.colorBy || '--');
  const [displayMode, setDisplayMode] = useState(storedSettings.displayMode || 'points');
  const [startDate, setStartDate] = useState(storedSettings.startDate || null);
  const [endDate, setEndDate] = useState(storedSettings.endDate || null);
  const [filters, setFilters] = useState(storedSettings.filters || []);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Initialize Mosaic coordinator and crossfilter Selection
  useEffect(() => {
    const initCoordinator = async () => {
      const coord = await getCoordinator();
      setMosaicCoordinator(coord);
      const selection = Selection.crossfilter();
      setFilterSelection(selection);

    };
    initCoordinator();
  }, []);

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

  // Save settings to localStorage
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
        startDate,
        endDate,
        filters
      };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings to localStorage:', e);
    }
  }, [selectedConnections, colorBy, displayMode, startDate, endDate, filters]);


  useEffect(() => {
    const restoreFromCache = async () => {
      if (!tableName) {
        if (cachedTableName && cachedTableSchema) {
          setTableName(cachedTableName);
          setTableSchema(cachedTableSchema);
          setCategoryMappings(cachedCategoryMappings);
          return;
        }

        try {
          const connector = await getConnector();
          const connection = await connector.getConnection();
          const tableNameToCheck = 'embedding_data';

          await connection.query(`SELECT COUNT(*) FROM "${tableNameToCheck}"`);

          const columnOrder = Object.keys(TABLE_SCHEMA);
          const columnTypes = TABLE_SCHEMA;
          setTableName(tableNameToCheck);
          setTableSchema(Object.fromEntries(columnOrder.map(k => [k, columnTypes[k]])));
          cachedTableName = tableNameToCheck;
          cachedTableSchema = Object.fromEntries(columnOrder.map(k => [k, columnTypes[k]]));
        } catch (error) {
        // ignore error
        }
      }
    };

    restoreFromCache();
  }, []);

  useEffect(() => {
    if (records && !cachedTableName) {
      processBackendData(records);
    }
  }, [records]);

  // Update Mosaic filter Selection when filters or selectedCategories change
  useEffect(() => {
    if (!filterSelection || !tableName || !mosaicCoordinator) {
      return;
    }

    const predicates = [];
    const currentMapping = colorBy && colorBy !== '--' ? categoryMappings[colorBy] : null;
    const categoryColumn = colorBy && colorBy !== '--' ? `category_${colorBy}` : null;

    // Legend filter (selectedCategories)
    if (currentMapping && categoryColumn && selectedCategories.length > 0) {
      const categoryPredicates = selectedCategories.map(idx =>
        SQL.eq(SQL.column(categoryColumn), idx)
      );
      const legendPredicate = categoryPredicates.length === 1
        ? categoryPredicates[0]
        : SQL.or(categoryPredicates);
      predicates.push(legendPredicate);
    }

    if (filters.length > 0) {
      const filterPredicates = filters.map(f =>
        SQL.eq(SQL.column(f.field), SQL.literal(f.value))
      );
      predicates.push(...filterPredicates);
    }

    if (predicates.length === 0) {
      filterSelection.update({
        source: 'filter-panel',
        predicate: null
      });
      return;
    }

    const combinedPredicate = predicates.length === 1
      ? predicates[0]
      : SQL.and(predicates);

    filterSelection.update({
      source: 'filter-panel',
      predicate: combinedPredicate
    });
  }, [filters, selectedCategories, tableName, categoryMappings, colorBy, mosaicCoordinator, filterSelection]);

  useEffect(() => {
    if (error) {
      setTableName(null);
      setTableSchema(null);
      setCategoryMappings({});
      cachedTableName = null;
      cachedTableSchema = null;
      cachedCategoryMappings = {};
    }
  }, [error]);

  const createCategoryMappingForField = useCallback((records, colorByField) => {
    if (!records || records.length === 0 || !colorByField || colorByField === '--') return null;

    const values = records.map(r => r[colorByField]);
    const uniqueValues = [...new Set(values.filter(v => v != null).map(v => String(v)))];

    if (uniqueValues.length === 0 && !values.some(v => v == null)) {
      return null;
    }

    const counts = {};
    values.forEach(v => {
      const key = v == null ? '__NULL__' : String(v);
      counts[key] = (counts[key] || 0) + 1;
    });

    const sortedValues = uniqueValues.sort((a, b) => (counts[b] || 0) - (counts[a] || 0));

    const valueToIndex = {};
    sortedValues.forEach((v, i) => {
      valueToIndex[v] = i;
    });

    const NULL_INDEX = sortedValues.length;
    const hasNull = values.some(v => v == null);

    const categoryCount = sortedValues.length + (hasNull ? 1 : 0);
    const colors = defaultCategoryColors(categoryCount);

    const legend = sortedValues.map((v, i) => {
      let label;
      if (colorByField === 'connection_id') {
        const connection = selectedConnections.find(c => String(c.id) === v);
        label = connection ? connection.name : v;
      } else {
        label = v;
      }
      return {
        label,
        color: colors[i],
        count: counts[v] || 0,
        categoryIndex: i
      };
    });

    if (hasNull) {
      legend.push({
        label: '(null)',
        color: colors[NULL_INDEX],
        count: counts['__NULL__'] || 0,
        categoryIndex: NULL_INDEX
      });
    }

    return {
      field: colorByField,
      valueToIndex,
      nullIndex: hasNull ? NULL_INDEX : null,
      colors,
      legend
    };
  }, [selectedConnections]);

  const processBackendData = async (records) => {
    setIsProcessingData(true);

    if (!records || records.length === 0) {
      setTableName(null);
      setTableSchema(null);
      setCategoryMappings({});
      cachedTableName = null;
      cachedTableSchema = null;
      cachedCategoryMappings = {};
      setIsProcessingData(false);
      return;
    }

    const validRecords = records.filter(record =>
      record.x != null &&
      record.y != null &&
      isFinite(parseFloat(record.x)) &&
      isFinite(parseFloat(record.y))
    );

    if (validRecords.length === 0) {
      setTableName(null);
      setTableSchema(null);
      setCategoryMappings({});
      cachedTableName = null;
      cachedTableSchema = null;
      cachedCategoryMappings = {};
      setIsProcessingData(false);
      return;
    }

    const allMappings = {};
    COLOR_BY_FIELDS.forEach(field => {
      const mapping = createCategoryMappingForField(validRecords, field);
      if (mapping) {
        allMappings[field] = mapping;
      }
    });
    setCategoryMappings(allMappings);
    cachedCategoryMappings = allMappings;

    const transformedRecords = validRecords.map((record, index) => {
      const baseRecord = {
        id: `record_${index}`,
        x: parseFloat(record.x),
        y: parseFloat(record.y),
        ...record
      };

      COLOR_BY_FIELDS.forEach(field => {
        const mapping = allMappings[field];
        const categoryKey = `category_${field}`;
        if (mapping) {
          const value = record[field];
          if (value == null) {
            baseRecord[categoryKey] = mapping.nullIndex ?? 0;
          } else {
            baseRecord[categoryKey] = mapping.valueToIndex[String(value)] ?? 0;
          }
        } else {
          baseRecord[categoryKey] = 0;
        }
      });

      return baseRecord;
    });

    setSelectedCategories([]);
    setFilters([]);

    await loadDataToDuckDB(transformedRecords);
  };

  const loadDataToDuckDB = async (allRecords) => {
    if (!allRecords || allRecords.length === 0) {
      setTableName(null);
      setTableSchema(null);
      setIsProcessingData(false);
      return;
    }

    setIsProcessingData(true);

    try {
      const connector = await getConnector();
      const connection = await connector.getConnection();

      const columnOrder = Object.keys(TABLE_SCHEMA);
      const columnTypes = TABLE_SCHEMA;

      const columnDefs = columnOrder.map(key => `"${key}" ${columnTypes[key]}`).join(', ');

      const newTableName = 'embedding_data';
      await connection.query(`DROP TABLE IF EXISTS "${newTableName}"`);
      await connection.query(`CREATE TABLE "${newTableName}" (${columnDefs})`);

      const batchSize = 1000;
      for (let i = 0; i < allRecords.length; i += batchSize) {
        const batch = allRecords.slice(i, i + batchSize);
        const values = batch.map(record => {
          const vals = columnOrder.map(key => {
            const v = record[key];
            const type = columnTypes[key];
            if (v === null || v === undefined) return 'NULL';
            if (type === 'DOUBLE' || type === 'INTEGER') {
              return Number(v);
            }
            if (type === 'BOOLEAN') {
              return v ? 'TRUE' : 'FALSE';
            }
            return `'${String(v).replace(/'/g, '\'\'')}'`;
          });
          return `(${vals.join(', ')})`;
        }).join(', ');

        await connection.query(`INSERT INTO ${newTableName} VALUES ${values}`);
      }

      setTableName(newTableName);
      setTableSchema(Object.fromEntries(columnOrder.map(k => [k, columnTypes[k]])));
      cachedTableName = newTableName;
      cachedTableSchema = Object.fromEntries(columnOrder.map(k => [k, columnTypes[k]]));
      setIsProcessingData(false);
    } catch (dbError) {
      console.error('Error loading data to DuckDB:', dbError);
      setTableName(null);
      setTableSchema(null);
      setIsProcessingData(false);
    }
  };

  useEffect(() => {
    if (selectedConnections.length === 0) {
      setTableName(null);
      setTableSchema(null);
      setCategoryMappings({});
      cachedTableName = null;
      cachedTableSchema = null;
      cachedCategoryMappings = {};
      resetAnalysis();
    }
  }, [selectedConnections, resetAnalysis]);

  const handleAnalyze = useCallback(() => {
    if (selectedConnections.length > 0) {
      startAnalysis(selectedConnections.map(c => c.id), startDate, endDate);
    }
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

    if (error) {
      return (
        <div className="d-flex justify-content-center align-items-center h-100">
          <div className="text-center">
            <i className="fas fa-exclamation-triangle text-warning" style={{ fontSize: '3rem' }}></i>
            <p className="text-muted mt-3">{error.message || gettext('No valid data available')}</p>
          </div>
        </div>
      );
    }

    if (isProcessingData) {
      return (
        <div className="d-flex justify-content-center align-items-center h-100">
          <Loading />
        </div>
      );
    }

    if (!tableName) {
      return (
        <div className="analyze-empty-state">
          <p className="analyze-empty-text">{gettext('Click Analyze to start')}</p>
        </div>
      );
    }

    if (!mosaicCoordinator) {
      return (
        <div className="d-flex justify-content-center align-items-center h-100">
          <Loading />
        </div>
      );
    }

    const currentMapping = colorBy && colorBy !== '--' ? categoryMappings[colorBy] : null;
    const useCategory = colorBy && colorBy !== '--' && currentMapping;

    return (
      <div className="embedding-visualization-container">
        <EmbeddingView
          coordinator={mosaicCoordinator}
          table={tableName}
          xColumn="x"
          yColumn="y"
          categoryColumn={useCategory ? `category_${colorBy}` : undefined}
          categoryColors={useCategory ? currentMapping.colors : undefined}
          identifierColumn="id"
          availableColumns={tableSchema ? Object.keys(tableSchema) : []}
          filter={filterSelection}
          displayMode={displayMode}
          width={dimensions.width}
          height={dimensions.height}
          onPointClick={handlePointClick}
        />

        {useCategory && currentMapping?.legend && (
          <Legend
            items={currentMapping.legend}
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
