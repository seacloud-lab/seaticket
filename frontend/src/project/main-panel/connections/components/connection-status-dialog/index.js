import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { Modal, ModalBody, ModalFooter, Button } from 'reactstrap';
import { gettext } from '@/constants';
import { CenteredLoading, ModalHeader, toaster, Icon } from '@/components';
import { connectionsAPI } from '@/project/api/connections-api';
import { Utils } from '@/utils/utils';
import { Connection } from '../../models';
import { CONNECTION_TYPE } from '../../constants';
import { formatWithTimezone } from '@/sea-metadata/utils/column';

import './index.css';

const allStatus = ['sync', 'index', 'ai-status', 'vector-index'];

const ConnectionStatusDialog = ({ projectUuid, connectionId, onToggle, onManualSync, record }) => {
  const [totalRecords, setTotalRecords] = useState('');
  const [isLoading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState([]);
  const [closestTime, setClosestTime] = useState(null);

  const getConnectionRecord = useCallback(() => {
    connectionsAPI.getConnection(projectUuid, connectionId).then(res => {
      const record = new Connection(res.data.record);
      setTotalRecords(record.status.total_records);
      const statusData = allStatus.map(status => {
        const { last_sync_status, last_sync_count } = record.status;
        if (status === 'sync') {
          return {
            title: gettext('Data sync'),
            time: record.last_sync_time,
            status: last_sync_status,
            label: gettext('Synced: ') + last_sync_count + ' ' + (last_sync_count < 2 ? gettext('record') : gettext('records')),
          };
        } else if (status === 'index') {
          const { last_index_status, last_indexed_count } = record.status;
          return {
            title: gettext('Index'),
            time: record.indexed_at,
            status: last_index_status,
            label: gettext('Indexed: ') + last_indexed_count + ' ' + (last_indexed_count < 2 ? gettext('record') : gettext('records')),
          };
        } else if (status === 'ai-status') {
          const { last_ai_processing_status, last_ai_processing_count } = record.ai_status;
          return {
            title: gettext('AI processing'),
            time: record.last_ai_processing_time,
            status: last_ai_processing_status,
            label: gettext('Processed: ') + last_ai_processing_count + ' ' + (last_ai_processing_count < 2 ? gettext('record') : gettext('records')),
          };
        } else if (status === 'vector-index' && (record.type === CONNECTION_TYPE.SITE || record.type === CONNECTION_TYPE.SEAFILE)) {
          const { last_content_vector_index_status, last_content_vector_indexed_count } = record.content_vector_status;
          return {
            title: gettext('Vector index'),
            time: record.content_vector_indexed_at,
            status: last_content_vector_index_status,
            label: gettext('Indexed: ') + last_content_vector_indexed_count + ' ' + (last_content_vector_indexed_count < 2 ? gettext('record') : gettext('records')),
          };
        }
        return null;
      });
      setStatusData(statusData);
      setClosestTime(getClosestTime(statusData));
      setLoading(false);
    }).catch((error) => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [isLoading]);

  useEffect(() => {
    getConnectionRecord();
  }, []);

  const getClosestTime = (statusData) => {
    if (!statusData || statusData.length === 0) return null;
    const now = dayjs();
    let closestTime = null;
    let minDiff = Infinity;
    statusData.forEach(data => {
      const time = data?.time;
      if (time) {
        const dataTime = dayjs(time);
        const diff = Math.abs(dataTime.diff(now));
        if (diff < minDiff) {
          minDiff = diff;
          closestTime = time;
        }
      }
    });
    return closestTime ? dayjs(closestTime).format('YYYY-MM-DD HH:mm:ss') : null;
  };

  const getStatusIcon = (status) => {
    if (!status) return null;
    if (status === 'completed') {
      return 'check-circle';
    }
    if (status === 'failed') {
      return 'close-circle-filled';
    }
    if (status === 'pending') {
      return 'time';
    }
    // 'indexing' 'crawling' 'processing' ——> 'spinner'
    return 'spinner';
  };

  return (
    <Modal isOpen={true} toggle={onToggle} className="connection-status-dialog">
      <ModalHeader toggle={onToggle}>{gettext('Connection status')}</ModalHeader>
      <ModalBody>
        {isLoading ?
          <CenteredLoading />
          :
          <div className="connection-status-container">
            <div className="status-header">
              <p>{gettext('Total records')}: {totalRecords}</p>
              {closestTime &&
                <p title={formatWithTimezone(closestTime)}>{gettext('Latest synchronization time') + ': ' + closestTime}</p>
              }
            </div>
            <div className="timeline">
              {statusData.map(data => {
                if (!data) return null;
                return (
                  <div className="timeline-item">
                    <div className='timeline-icon'>
                      <Icon symbol={getStatusIcon(data.status)} />
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-title">{data.title}</div>
                      <div className="timeline-stats">{data?.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        }
      </ModalBody>
      <ModalFooter>
        <Button onClick={onToggle} color="secondary">{gettext('Close')}</Button>
        <Button onClick={() => { onManualSync(record); onToggle(); }} color="primary">{gettext('Sync now')}</Button>
      </ModalFooter>
    </Modal>
  );
};

ConnectionStatusDialog.propTypes = {
  projectUuid: PropTypes.string,
  record: PropTypes.object,
  onToggle: PropTypes.func.isRequired,
  onManualSync: PropTypes.func.isRequired,
};

export default ConnectionStatusDialog;
