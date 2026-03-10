import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import classNames from 'classnames';
import { gettext } from '@/constants';
import { CenteredLoading, ModalHeader, toaster, Icon } from '@/components';
import { connectionsAPI } from '@/project/api/connections-api';
import { Utils } from '@/utils/utils';
import { Connection } from '../../models';
import DateFormatter from '../cell-formatter/date-formatter';
import { CONNECTION_TYPE } from '../../constants';

import './index.css';

const allStatus = ['sync', 'index', 'ai-status', 'vector-index'];
const ConnectionStatusDialog = ({ projectUuid, connectionId, onToggle }) => {
  const [totalRecords, setTotalRecords] = useState('');
  const [isLoading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState([]);

  const getConnectionRecord = useCallback(() => {
    connectionsAPI.getConnection(projectUuid, connectionId).then(res => {
      const record = new Connection(res.data.record);
      record.status.last_indexed_count = 1;
      setTotalRecords(record.status.total_records);
      setStatusData(allStatus.map(status => {
        if (status === 'sync') {
          return {
            title: gettext('Last sync status'),
            time: record.last_sync_time,
            status: record.status.last_sync_status,
            count: record.status.last_sync_count,
            label: record.status.last_sync_count === 1 ? gettext('record synced') : gettext('records synced'),
            iconClassName: 'sync-status',
            iconType: 'sync',
          };
        } else if (status === 'index') {
          return {
            title: gettext('Last index status'),
            time: record.indexed_at,
            status: record.status.last_index_status,
            count: record.status.last_indexed_count,
            label: record.status.last_indexed_count === 1 ? gettext('record indexed') : gettext('records indexed'),
            iconClassName: 'index-status',
            iconType: 'index',
          };
        } else if (status === 'ai-status') {
          return {
            title: gettext('Last AI processing status'),
            time: record.last_ai_processing_time,
            status: record.ai_status.last_ai_processing_status,
            count: record.ai_status.last_ai_processing_count,
            label: record.ai_status.last_ai_processing_count === 1 ? gettext('record processed') : gettext('records processed'),
            iconClassName: 'ai-status',
            iconType: 'ai-processing',
          };
        } else if (status === 'vector-index' && (record.type === CONNECTION_TYPE.SITE || record.type === CONNECTION_TYPE.SEAFILE)) {
          return {
            title: gettext('Last vector indexed status'),
            time: record.content_vector_indexed_at,
            status: record.content_vector_status.last_content_vector_index_status,
            count: record.content_vector_status.last_content_vector_indexed_count,
            label: record.content_vector_status.last_content_vector_indexed_count === 1 ? gettext('record indexed') : gettext('records indexed'),
            iconClassName: 'index-status',
            iconType: 'index',
          };
        }
        return null;
      }));
      setLoading(false);
    }).catch((error) => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [isLoading]);

  const renderLabel = useCallback((count, label) => {
    if (!count || count === 0) return gettext('No') + ' ' + label;
    return count + ' ' + label;
  }, []);

  useEffect(() => {
    getConnectionRecord();
  }, []);

  return (
    <Modal isOpen={true} toggle={onToggle} className="connection-status-dialog">
      <ModalHeader toggle={onToggle}>{gettext('Connection status')}</ModalHeader>
      <ModalBody>
        {isLoading ?
          <CenteredLoading />
          :
          <div className="connection-status-container">
            <div className="status-header">
              <div className="total-records">{gettext('Total records')}: {totalRecords}</div>
            </div>
            <div className="timeline">
              {statusData.map(data => {
                if (!data) return null;
                return (
                  <div className="timeline-item">
                    <div className={classNames('timeline-icon', data?.iconClassName)}>
                      <Icon symbol={data?.iconType} />
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-title">
                        {data?.title} {data?.status}
                      </div>
                      <div className="timeline-time">
                        <DateFormatter value={data?.time} />
                      </div>
                      <div className="timeline-stats">
                        {renderLabel(data?.count, data?.label)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        }
      </ModalBody>
    </Modal>
  );
};

ConnectionStatusDialog.propTypes = {
  projectUuid: PropTypes.string,
  record: PropTypes.object,
  onToggle: PropTypes.func.isRequired
};

export default ConnectionStatusDialog;
