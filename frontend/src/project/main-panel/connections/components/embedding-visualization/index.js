import React, { useState, useEffect, useMemo } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import { EmbeddingView, defaultCategoryColors } from 'embedding-atlas/react';
import { gettext } from '@/constants';
import { Loading, ModalHeader } from '@/components';
import { connectionsAPI } from '@/project/api';
import './index.css';

const EmbeddingVisualization = ({ onClose, connectionId, connectionName, projectUuid }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [embeddingData, setEmbeddingData] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]);

  useEffect(() => {
    if (connectionId && projectUuid) {
      setIsLoading(true);
      setSelectedCategories([]);

      connectionsAPI.getEmbeddingAnalysis(projectUuid, connectionId).then(response => {
        const { task_id } = response.data;
        const pollTaskStatus = () => {
          connectionsAPI.getEmbeddingAnalysisTaskStatus(task_id)
            .then(statusResponse => {
              const { is_finished, records } = statusResponse.data;
              if (is_finished) {
                processBackendData(records);
              } else {
                setTimeout(pollTaskStatus, 2000);
              }
            })
            .catch(error => {
              console.error('Failed to fetch task status:', error);
              setIsLoading(false);
              setEmbeddingData(null);
              setMetadata({
                error: true,
                errorMessage: error.response?.data?.error_msg || 'Failed to check task status'
              });
            });
        };
        pollTaskStatus();
      }).catch(error => {
        console.error('Failed to submit embedding analysis task:', error);
        setIsLoading(false);
        setEmbeddingData(null);
        setMetadata({
          error: true,
          errorMessage: error.response?.data?.error_msg
        });
      });
    }
  }, [connectionId, projectUuid]);

  const processBackendData = (records) => {
    if (!records || records.length === 0) {
      setIsLoading(false);
      setEmbeddingData(null);
      setMetadata({
        error: true,
        errorMessage: 'No data for analysis'
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
        errorMessage: 'No valid coordinates found in data'
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

  const createCategoryMapping = (records) => {
    if (!records || records.length === 0) return null;

    if (!records[0].hasOwnProperty('state')) {
      return null;
    }

    const values = records.map(r => r.state);
    const uniqueValues = [...new Set(values.filter(v => v != null))];

    return createDiscreteMapping(values, uniqueValues);
  };

  const createDiscreteMapping = (values, uniqueValues) => {
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

    const legend = sortedValues.map((v, i) => ({
      label: String(v),
      color: colors[i],
      count: counts[String(v)],
      categoryIndex: i
    }));

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
    return createCategoryMapping(metadata.records);
  }, [metadata]);

  const categoryData = useMemo(() => {
    if (!baseCategoryData) {
      return null;
    }

    if (selectedCategories.length === 0) {
      return baseCategoryData;
    }

    const filteredCategories = new Uint8Array(baseCategoryData.originalCategories.length);
    const HIDDEN_INDEX = 255;

    for (let i = 0; i < baseCategoryData.originalCategories.length; i++) {
      const categoryIndex = baseCategoryData.originalCategories[i];
      if (selectedCategories.includes(categoryIndex)) {
        filteredCategories[i] = categoryIndex;
      } else {
        filteredCategories[i] = HIDDEN_INDEX;
      }
    }

    const colors = [...baseCategoryData.colors, 'rgba(200, 200, 200, 0.1)'];

    return {
      ...baseCategoryData,
      categories: filteredCategories,
      colors: colors
    };
  }, [baseCategoryData, selectedCategories]);

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

  const querySelection = async (x, y, unitDistance) => {
    if (!embeddingData || !metadata || !metadata.records) {
      return null;
    }

    let minDistance2 = null;
    let minIndex = null;

    for (let i = 0; i < embeddingData.x.length; i++) {
      const dx = embeddingData.x[i] - x;
      const dy = embeddingData.y[i] - y;
      const d2 = dx * dx + dy * dy;

      if (minDistance2 == null || d2 < minDistance2) {
        minDistance2 = d2;
        minIndex = i;
      }
    }

    if (minIndex == null || minDistance2 == null || Math.sqrt(minDistance2) > unitDistance * 10) {
      return null;
    }

    const record = metadata.records[minIndex];
    return {
      x: embeddingData.x[minIndex],
      y: embeddingData.y[minIndex],
      text: record.ai_summary,
      fields: record
    };
  };

  return (
    <Modal isOpen={true} toggle={onClose} size="xl" style={{ maxWidth: '90%' }}>
      <ModalHeader toggle={onClose}>
        {gettext('Visual Analytics')} - {connectionName}
      </ModalHeader>
      <ModalBody style={{ height: '75vh', position: 'relative', padding: 0 }}>
        {isLoading ? (
          <div className="d-flex justify-content-center align-items-center h-100">
            <Loading />
          </div>
        ) : metadata?.error ? (
          <div className="d-flex justify-content-center align-items-center h-100">
            <div className="text-center">
              <i className="fas fa-exclamation-triangle text-warning" style={{ fontSize: '3rem' }}></i>
              <p className="text-muted mt-3">{metadata.errorMessage || gettext('No valid data available')}</p>
            </div>
          </div>
        ) : (
          <div className="embedding-visualization-container">
            <EmbeddingView
              data={{
                x: embeddingData.x,
                y: embeddingData.y,
                category: categoryData?.categories || null
              }}
              categoryColors={categoryData?.colors || null}
              tooltip={tooltip}
              onTooltip={setTooltip}
              querySelection={querySelection}
              labels={[]}
              width={window.innerWidth * 0.85}
              height={window.innerHeight * 0.75}
              config={{
                colorScheme: 'light',
                mode: 'points',
                pointSize: 5,
                pointOpacity: 0.8
              }}
            />

            {categoryData?.legend && (
              <div className="embedding-legend">
                {categoryData.legend.map((item, index) => {
                  const isSelected = selectedCategories.length === 0 || selectedCategories.includes(item.categoryIndex);
                  return (
                    <div
                      key={index}
                      className="legend-item"
                      style={{ opacity: isSelected ? 1 : 0.3, cursor: 'pointer' }}
                      onClick={(e) => handleLegendItemClick(item.categoryIndex, e)}
                    >
                      <span
                        className="legend-color"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="legend-label">{item.label}</span>
                      <span className="legend-count">({item.count})</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </ModalBody>
    </Modal>
  );
};

export default EmbeddingVisualization;
