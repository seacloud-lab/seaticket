import React, { useState, useEffect } from 'react';
import { Modal, ModalHeader, ModalBody } from 'reactstrap';
import { EmbeddingView } from 'embedding-atlas/react';
import { gettext } from '@/constants';
import { Loading } from '@/components';
import { connectionsAPI } from '@/project/api';
import './index.css';

const EmbeddingVisualization = ({ isOpen, onClose, connectionId, connectionName, projectUuid, viewId }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [embeddingData, setEmbeddingData] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    if (isOpen && connectionId && projectUuid) {
      setIsLoading(true);

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
  }, [isOpen, connectionId, projectUuid, viewId]);

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
    <Modal isOpen={isOpen} toggle={onClose} size="xl" style={{ maxWidth: '90%' }}>
      <ModalHeader toggle={onClose}>
        {gettext('Visual Analytics')} - {connectionName}
      </ModalHeader>
      <ModalBody style={{ height: '75vh', position: 'relative' }}>
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
              data={embeddingData}
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
          </div>
        )}
      </ModalBody>
    </Modal>
  );
};

export default EmbeddingVisualization;
