import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import { gettext } from '@/constants';
import { CenteredLoading, ModalHeader, toaster, Icon } from '@/components';
import { connectionsAPI } from '@/project/api/connections-api';
import { Utils } from '@/utils/utils';
import { Connection } from '../../models';
import DateFormatter from '../cell-formatter/date-formatter';
import { CONNECTION_TYPE } from '../../constants';

import './index.css';

const ConnectionStatusDialog = ({ projectUuid, connectionId, onToggle }) => {
  const [record, setRecord] = useState(null);
  const [isLoading, setLoading] = useState(true);

  const getConnectionRecord = useCallback(() => {
    connectionsAPI.getConnection(projectUuid, connectionId).then(res => {
      setRecord(new Connection(res.data.record));
      setLoading(false);
    }).catch((error) => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [record, isLoading]);

  useEffect(() => {
    getConnectionRecord();
  }, []);

  console.log('record', record);

  return (
    <Modal isOpen={true} toggle={onToggle} className="connection-status-dialog">
      <ModalHeader toggle={onToggle}>{gettext('Connection status')}</ModalHeader>
      <ModalBody>
        {isLoading ?
          <CenteredLoading />
          :
          <div className="connection-status-container">
            <div className="status-header">
              <div className="total-records">{gettext('Total records')}: {record.status.total_records}</div>
            </div>
            <div className="timeline">
              {/* Last Sync Status */}
              <div className="timeline-item">
                <div className="timeline-icon sync-status">
                  <Icon symbol="sync" />
                </div>
                <div className="timeline-content">
                  <div className="timeline-title">
                    {gettext('Last sync status')} {record.status.last_sync_status}
                  </div>
                  <div className="timeline-time">
                    <DateFormatter value={record.last_sync_time} />
                  </div>
                  <div className="timeline-stats">
                    <span className="stat-value">{record.status.last_sync_count}</span>
                    <span className="stat-label">{gettext('records synced')}</span>
                  </div>
                </div>
              </div>

              {/* Last Index Status */}
              <div className="timeline-item">
                <div className="timeline-icon index-status">
                  <Icon symbol="index" />
                </div>
                <div className="timeline-content">
                  <div className="timeline-title">
                    {gettext('Last index status')} {record.status.last_index_status}
                  </div>
                  <div className="timeline-time">
                    <DateFormatter value={record.indexed_at} />
                  </div>
                  <div className="timeline-stats">
                    <span className="stat-value">{record.status.last_indexed_count}</span>
                    <span className="stat-label">{gettext('records indexed')}</span>
                  </div>
                </div>
              </div>

              {/* Last AI Processing Status */}
              <div className="timeline-item">
                <div className="timeline-icon ai-status">
                  <Icon symbol="ai-processing" />
                </div>
                <div className="timeline-content">
                  <div className="timeline-title">
                    {gettext('Last AI processing status')} {record.ai_status.last_ai_processing_status}
                  </div>
                  <div className="timeline-time">
                    <DateFormatter value={record.last_ai_processing_time} />
                  </div>
                  <div className="timeline-stats">
                    <span className="stat-value">{record.ai_status.last_ai_processing_count}</span>
                    <span className="stat-label">{gettext('records processed')}</span>
                  </div>
                </div>
              </div>

              {/* Vector Indexed Status (for SITE type) */}
              {record.type === CONNECTION_TYPE.SITE &&
                <div className="timeline-item">
                  <div className="timeline-icon pending">
                    <Icon symbol="vector" />
                  </div>
                  <div className="timeline-content">
                    <div className="timeline-title">
                      {gettext('Last vector indexed status')} {record.content_vector_status.last_content_vector_index_status}
                    </div>
                    <div className="timeline-time">
                      <DateFormatter value={record.content_vector_indexed_at} />
                    </div>
                    <div className="timeline-stats">
                      <span className="stat-value">{record.content_vector_status.last_content_vector_indexed_count}</span>
                      <span className="stat-label">{gettext('records indexed')}</span>
                    </div>
                  </div>
                </div>
              }
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
