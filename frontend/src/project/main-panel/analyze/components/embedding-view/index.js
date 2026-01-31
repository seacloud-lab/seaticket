import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { EmbeddingViewMosaic, defaultCategoryColors } from 'embedding-atlas/react';
import { Coordinator, wasmConnector, Selection } from '@uwdata/mosaic-core';
import * as SQL from '@uwdata/mosaic-sql';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import Legend from '../legend';
import { CenteredLoading, EmptyTip } from '@/components';
import { gettext } from '@/constants';
import { TABLE_SCHEMA, COLOR_BY_FIELDS, projectUuid } from '../../constants';

import './index.css';

const columnKeys = Object.keys(TABLE_SCHEMA);
const columnDefs = columnKeys.map(key => `"${key}" ${TABLE_SCHEMA[key]}`).join(', ');
const tableName = 'embedding_data';

const EmbeddingView = ({
  xColumn = 'x',
  yColumn = 'y',
  identifierColumn = 'id',
  lastLoadRecordsTime,
  connections,
  filters, // Mosaic Selection for filtering
  colorBy,
  displayMode,
  records,
}) => {
  const containerRef = useRef(null);
  const wasmConnectorRef = useRef(wasmConnector());
  const coordinatorRef = useRef(new Coordinator(wasmConnectorRef.current));
  const filterSelectionRef = useRef(Selection.crossfilter());
  const lastRenderTime = useRef(null);

  const [size, setSize] = useState({ width: 800, height: 800 });

  const [tooltip, setTooltip] = useState(null);
  const [selection, setSelection] = useState([]);

  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

  const [categoryMappings, setCategoryMappings] = useState();
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [isProcessingData, setIsProcessingData] = useState(true);

  const config = useMemo(() => ({
    colorScheme: 'light',
    mode: displayMode,
    minimumDensity: displayMode === 'density' ? 0.001 : null,
    pointSize: 4,
  }), [displayMode]);

  const additionalFields = useMemo(() => {
    if (columnKeys.length === 0) return null;
    const neededFields = ['ai_summary', '_pk', 'title', 'connection_id', 'connection_type', 'path', 'filename', 'url', 'slug', 'topic_id', 'state'];
    const fields = {};
    neededFields.forEach(col => {
      if (columnKeys.includes(col)) {
        fields[col] = col;
      }
    });
    return Object.keys(fields).length > 0 ? fields : null;
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

  const handleSelection = useCallback((newSelection) => {
    if (newSelection && newSelection.length > 0) {
      const point = newSelection[0];
      if (point?.fields) {
        handlePointClick(point.fields);
      }
      setTimeout(() => setSelection([]), 0);
    } else {
      setSelection(newSelection);
    }
  }, [handlePointClick]);

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

  const createCategoryMappingForField = useCallback((connections, records, colorByField) => {
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
        const connection = connections.find(c => String(c.id) === v);
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
  }, []);

  useEffect(() => {
    if (!Array.isArray(records) || records.length === 0) return;
    if (isDetailsDialogOpen) return;
    const dom = containerRef.current;
    const handleResize = () => {
      if (!dom) return;
      const { width, height } = dom.getBoundingClientRect();
      setSize({ width, height });
    };
    const resizeObserver = new ResizeObserver(handleResize);
    dom && resizeObserver.observe(dom);
    handleResize();
    return () => {
      dom && resizeObserver.unobserve(dom);
    };
  }, [records, isProcessingData]);

  useEffect(() => {
    if (!Array.isArray(records) || records.length === 0) {
      setCategoryMappings({});
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
      setCategoryMappings({});
      setIsProcessingData(false);
      return;
    }
    if (lastRenderTime.current === lastLoadRecordsTime) return;
    lastRenderTime.current = lastLoadRecordsTime;
    setIsProcessingData(true);

    const allMappings = {};
    COLOR_BY_FIELDS.forEach(field => {
      const mapping = createCategoryMappingForField(connections, validRecords, field);
      if (mapping) {
        allMappings[field] = mapping;
      }
    });
    setCategoryMappings(allMappings);

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

    const insertData = async (data) => {
      try {
        await coordinatorRef.current.query(`DROP TABLE IF EXISTS "${tableName}"`);
        await coordinatorRef.current.query(`CREATE TABLE "${tableName}" (${columnDefs})`);

        const batchSize = 1000;
        for (let i = 0; i < data.length; i += batchSize) {
          const batch = data.slice(i, i + batchSize);
          const values = batch.map(record => {
            const vals = columnKeys.map(key => {
              const v = record[key];
              const type = TABLE_SCHEMA[key];
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
          await coordinatorRef.current.query(`INSERT INTO ${tableName} VALUES ${values}`);
        }
        console.log('计算完成');
        setIsProcessingData(false);
      } catch (dbError) {
        console.error('Error loading data to DuckDB:', dbError);
        setIsProcessingData(false);
      }
    };
    insertData(transformedRecords);
  }, [records, connections, lastLoadRecordsTime]);

  // Update Mosaic filter Selection when filters or selectedCategories change
  useEffect(() => {
    if (!filterSelectionRef.current) return;

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
      filterSelectionRef.current.update({
        source: 'filter-panel',
        predicate: null
      });
      return;
    }

    const combinedPredicate = predicates.length === 1 ? predicates[0] : SQL.and(predicates);

    filterSelectionRef.current.update({
      source: 'filter-panel',
      predicate: combinedPredicate
    });
  }, [filters, selectedCategories, categoryMappings, colorBy]);

  if (!Array.isArray(records)) {
    return (
      <div className="analyze-empty-state">
        <p className="analyze-empty-text">{gettext('Click Analyze to start')}</p>
      </div>
    );
  }

  if (records.length === 0) return (<EmptyTip />);
  if (isProcessingData) {
    return (<CenteredLoading />);
  }

  const textColumn = columnKeys?.includes('ai_summary') ? 'ai_summary' : null;
  const currentMapping = colorBy && colorBy !== '--' ? categoryMappings[colorBy] : null;
  const useCategory = colorBy && colorBy !== '--' && currentMapping;
  const categoryColumn = useCategory ? `category_${colorBy}` : undefined;
  const categoryColors = useCategory ? currentMapping.colors : undefined;

  console.log(size);
  return (
    <>
      <div className="embedding-visualization-container" ref={containerRef}>
        <EmbeddingViewMosaic
          coordinator={coordinatorRef.current}
          table={tableName}
          x={xColumn}
          y={yColumn}
          category={categoryColumn}
          categoryColors={categoryColors}
          identifier={identifierColumn}
          text={textColumn}
          additionalFields={additionalFields}
          filter={filterSelectionRef.current}
          tooltip={tooltip}
          onTooltip={setTooltip}
          selection={selection}
          onSelection={handleSelection}
          labels={[]}
          width={size.width}
          height={size.height}
          config={config}
        />
        {useCategory && currentMapping?.legend && (
          <Legend
            items={currentMapping.legend}
            selectedCategories={selectedCategories}
            onItemClick={handleLegendItemClick}
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

export default EmbeddingView;
