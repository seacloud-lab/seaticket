import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { Dropdown } from 'reactstrap';
import { useConnectionsPage } from '../../../hooks';
import { CenteredLoading, IconButton, CustomizeDropdownMoreToggle, CustomizeDropdownMenu, CustomizeDropdownItem } from '@/components';
import { getTableName, generateAIOptions, generateFindRelatedIssuesOption } from '../../../utils';
import { useData } from '@/project/hooks';
import { useConnections } from '../../../hooks';
import ConnectionResourceDetails from '../../../components/connection-resource-details';
import { getResourceOriginalURL } from '@/project/utils';
import { gettext } from '@/constants';
import { AttachmentObject } from '@/project/main-panel/ask/models';
import { useAIChatTools } from '@/project/main-panel/ask/hooks';
import { BAR_TYPE } from '@/project/constants';
import RelatedIssuesDialog from '../../../components/related-issues-dialog';

import './index.css';

const initColumns = [
  { key: 'filename', name: 'filename' },
  { key: 'path', name: 'path' },
  { key: 'title', name: 'title' },
  { key: 'url', name: 'url' },
  { key: 'slug', name: 'slug' },
  { key: 'topic_id', name: 'topic_id' },
];

const Record = ({ projectUuid, toggleBar }) => {
  const { isLoading: isConnectionsPageLoading, pageSlugId, childrenPageSlugId, updateConnectionInfo } = useConnectionsPage();
  const { getRow } = useData();
  const { connections } = useConnections();
  const { updateAttachments } = useAIChatTools();

  const [containerWidth, setContainerWidth] = useState(0);
  const [details, setDetails] = useState(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isShowRelatedIssuesDialog, setIsShowRelatedIssuesDialog] = useState(false);

  const recordRef = useRef(null);

  const connection = useMemo(() => connections.find(c => c.id === pageSlugId), [pageSlugId, connections]);
  const resource = useMemo(() => ({ type: connection?.type, connection_id: pageSlugId, _id: childrenPageSlugId }), [connection, pageSlugId, childrenPageSlugId]);
  const tools = useMemo(() => {
    if (!details) return [];
    return [
      generateAIOptions({ rows: [details], columns: initColumns, connection }, (attachments) => {
        if (!Array.isArray(attachments) || attachments.length === 0) return;
        const newAttachments = attachments.map(attachment => new AttachmentObject(attachment));
        updateAttachments(newAttachments);
        toggleBar([BAR_TYPE.CHAT]);
      }),
      generateFindRelatedIssuesOption({ row: details, connection }, () => setIsShowRelatedIssuesDialog(true)),
    ].filter(Boolean);
  }, [details, connection, updateAttachments, toggleBar]);

  const cacheRecord = useMemo(() => {
    if (!connection) return '';
    const connectionTableName = getTableName(connection);
    const row = getRow(connectionTableName, childrenPageSlugId);
    return row;
  }, [connection, childrenPageSlugId, getRow]);

  const title = useMemo(() => {
    if (details && details.title) return details.title;
    if (!cacheRecord) return '';
    return cacheRecord.title;
  }, [details, cacheRecord]);

  const url = useMemo(() => {
    if (!connection) return '';
    if (!details) return '';
    return getResourceOriginalURL(connection.type, { ...details, ...resource }, connections, initColumns);
  }, [connection, connections, resource, details]);

  const updateDetails = useCallback((details) => {
    setDetails(details?.title ? details : '');
  }, [updateConnectionInfo]);

  useEffect(() => {
    if (isConnectionsPageLoading || !details) return;
    const recordDom = recordRef.current;
    const handleResize = () => {
      if (!recordDom) return;
      setContainerWidth(recordDom.offsetWidth);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    recordDom && resizeObserver.observe(recordDom);

    return () => {
      recordDom && resizeObserver.unobserve(recordDom);
    };
  }, [isConnectionsPageLoading, details]);

  if (isConnectionsPageLoading) return (<CenteredLoading />);

  // 904: details min-width(596) + others min-width(260) + gap: 16 * 3
  const isSmallScreen = details && containerWidth < 904;
  return (
    <>
      <div className={classnames('sea-connection-record-details', { 'small': isSmallScreen })} ref={recordRef}>
        <div className="sea-connection-record-details-header">
          <div className="sea-connection-record-details-header-left">
            {title && (
              <>
                {title && (<div className="text-truncate d-inline-block" title={title}>{title}</div>)}
                {url && (
                  <IconButton
                    className="open-in-new-tab-btn"
                    icon="open-in-new-tab"
                    title={gettext('Open the original URL in a new tab')}
                    onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                  />
                )}
              </>
            )}
          </div>
          <div className="sea-connection-record-details-header-right">
            {tools.length > 0 && (
              <Dropdown isOpen={isMoreMenuOpen} toggle={() => setIsMoreMenuOpen(!isMoreMenuOpen)}>
                <CustomizeDropdownMoreToggle isOpen={isMoreMenuOpen} title={gettext('More')} />
                <CustomizeDropdownMenu className="position-fixed">
                  {tools.map(tool => {
                    return (
                      <CustomizeDropdownItem
                        key={tool.key}
                        onClick={() => {
                          tool.callback && tool.callback();
                          setIsMoreMenuOpen(false);
                        }}
                      >
                        {tool.label}
                      </CustomizeDropdownItem>
                    );
                  })}
                </CustomizeDropdownMenu>
              </Dropdown>
            )}
          </div>
        </div>
        <div className={classnames('sea-connection-record-details-body', { 'empty': !details })}>
          <div className="sea-connection-record-details-container">
            <ConnectionResourceDetails resource={resource} projectUuid={projectUuid} updateDetails={updateDetails} />
          </div>
          {details && (<div className="sea-connection-record-details-others"></div>)}
        </div>
      </div>
      {isShowRelatedIssuesDialog && (
        <RelatedIssuesDialog
          projectUuid={projectUuid}
          row={{ _id: childrenPageSlugId }}
          connectionId={connection?.id}
          onClose={() => setIsShowRelatedIssuesDialog(false)}
        />
      )}
    </>
  );
};

export default Record;
