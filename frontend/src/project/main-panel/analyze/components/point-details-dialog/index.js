import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import { ModalHeader, CenteredError, CenteredLoading, IconButton } from '@/components';
import { gettext } from '@/constants';
import { connectionsAPI } from '@/project/api';
import { Utils } from '@/utils/utils';
import { initConnectionRecordDetail } from '../../../connections/utils';
import { CONNECTION_TYPE } from '../../../connections/constants';
import { useConnections } from '../../../connections/hooks';
import Details from '../../../connections/components/row-details-dialog/details';

import '../../../connections/components/row-details-dialog/index.css';

const PointDetailsDialog = ({
  projectUuid,
  record,
  onClose,
}) => {
  const [rowDetails, setRowDetails] = useState(null);
  const [errMessage, setErrMessage] = useState('');
  const [status, setStatus] = useState('loading');

  const { connections, reloadConnections } = useConnections();

  useEffect(() => {
    reloadConnections();
  }, [reloadConnections]);

  const connectionId = record?.connection_id;
  const recordId = record?._pk;
  const connectionType = record?.connection_type;

  const title = rowDetails?.title || record?.title || record?.ai_summary || '';

  const url = useMemo(() => {
    const connection = connections.find(c => c.id === Number(connectionId));
    if (!connection) return '';

    switch (connection.type) {
      case CONNECTION_TYPE.DISCOURSE_FORUM: {
        const discourseBaseUrl = connection.config?.url;
        if (!discourseBaseUrl) return '';
        const slug = record?.slug;
        const topicId = record?.topic_id;
        if (!slug || !topicId) return '';
        const baseUrl = discourseBaseUrl.replace(/\/$/, '');
        return `${baseUrl}/t/${slug}/${topicId}`;
      }
      case CONNECTION_TYPE.SITE:
      case CONNECTION_TYPE.GITHUB_ISSUE: {
        return record?.url || '';
      }
      case CONNECTION_TYPE.SEAFILE: {
        const { server_url, repo_id } = connection.config || {};
        if (!server_url || !repo_id) return '';
        const path = record?.path;
        const recordTitle = record?.title;
        if (!path || !recordTitle) return '';
        const baseUrl = server_url.replace(/\/$/, '');
        const filePath = path.replace(/\/$/, '');
        return `${baseUrl}/lib/${repo_id}/file${filePath}/${recordTitle}`;
      }
      default: {
        return '';
      }
    }
  }, [connections, connectionId, record, recordId]);

  const getRowDetails = useCallback(() => {
    if (!connectionId || !recordId) {
      setStatus('error');
      setErrMessage(gettext('Missing connection or record information'));
      return;
    }

    setStatus('loading');
    const params = { _pk: recordId };
    if (connectionType === CONNECTION_TYPE.SITE) {
      params.url = record?.url;
    }
    connectionsAPI.getConnectionRowDetail(projectUuid, connectionId, params)
      .then((res) => {
        const detailData = initConnectionRecordDetail(res.data);
        setRowDetails(detailData);
        setStatus('loaded');
      })
      .catch((error) => {
        const errMessage = Utils.getErrorMsg(error);
        setErrMessage(errMessage);
        setStatus('error');
      });
  }, [projectUuid, connectionId, recordId, connectionType, record]);

  useEffect(() => {
    getRowDetails();
  }, [getRowDetails]);

  const handleOpenOriginal = useCallback(() => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [url]);

  return (
    <Modal className="sea-qa-row-details-container" isOpen={true} toggle={onClose} style={{ minWidth: 800 }}>
      <ModalHeader toggle={onClose}>
        <div className="d-flex align-items-center">
          <div className="text-truncate" title={title}>{title}</div>
          {url && (
            <IconButton
              className="open-in-new-tab-btn ml-2"
              icon="open-in-new-tab"
              title={gettext('Open in new tab')}
              onClick={handleOpenOriginal}
            />
          )}
        </div>
      </ModalHeader>
      <ModalBody>
        {status === 'loading' && (
          <CenteredLoading />
        )}
        {status === 'error' && (
          <CenteredError>{errMessage}</CenteredError>
        )}
        {status === 'loaded' && (
          <Details
            details={rowDetails?.details}
            type={connectionType}
            projectUuid={projectUuid}
            connection={{ id: connectionId, type: connectionType }}
          />
        )}
      </ModalBody>
    </Modal>
  );
};

export default PointDetailsDialog;
