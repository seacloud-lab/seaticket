import React, { useCallback, useMemo, useState } from 'react';
import classnames from 'classnames';
import LinkItem from './link-item';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import { useConnections } from '@/project/main-panel/connections/hooks';
import { TICKET_TABLE_NAME, TICKET_TYPE } from '@/project/main-panel/tickets/constants';
import { PORTAL_ISSUE_TYPE } from '@/project/main-panel/portal-issues/constants';

import './index.css';

const { projectUuid } = window.app.pageOptions;

const LinkFormatter = ({ value, className, column, metadata, children: emptyFormatter }) => {
  const [isShowDetailsDialog, setIsShowDetailsDialog] = useState(false);
  const [currentLinkItem, setCurrentLinkItem] = useState(null);
  const { connections } = useConnections();

  const validValue = useMemo(() => {
    let _value = value;
    if (!Array.isArray(value)) _value = [value + ''];
    if (_value.length === 0) return [];
    const { linked_records } = metadata;
    return _value.filter(v => linked_records[v]);
  }, [value, metadata]);

  const validValueTitles = useMemo(() => {
    const { linked_records } = metadata;
    return validValue.map(v => linked_records[v]).filter(Boolean).join(', ');
  }, [validValue, metadata]);

  const initLinkItem = useCallback((linkItem) => {
    if (column?.data?.linked_table === TICKET_TABLE_NAME) {
      setCurrentLinkItem({ _id: linkItem, connection_id: '', type: TICKET_TYPE, key: linkItem });
      return;
    }

    const [connectionId, record_id] = linkItem.split('_');

    // Handle portal_ prefix
    if (connectionId === 'portal') {
      setCurrentLinkItem({ _id: record_id, connection_id: '', type: PORTAL_ISSUE_TYPE, key: linkItem });
      return;
    }

    let validConnectionId = Number(connectionId);
    const connection = connections.find(c => c.id === validConnectionId);
    if (!connection) return;
    setCurrentLinkItem({ _id: record_id, connection_id: connection.id, type: connection.type, key: linkItem });
  }, [connections, column]);

  const handleExpand = useCallback((linkItem) => {
    initLinkItem(linkItem);
    setIsShowDetailsDialog(true);
  }, [initLinkItem]);

  const handleCloseExpand = useCallback(() => {
    setCurrentLinkItem(null);
    setIsShowDetailsDialog(false);
  }, []);

  const switchLinkItem = useCallback((step) => {
    const index = validValue.findIndex(v => v === currentLinkItem.key);
    if (index === -1) return;

    let newIndex = index + step;
    if (newIndex > validValue.length - 1) {
      newIndex = 0;
    }
    if (newIndex < 0) {
      newIndex = validValue.length - 1;
    }
    const nextLinkItem = validValue[newIndex];
    initLinkItem(nextLinkItem);
  }, [validValue, currentLinkItem, initLinkItem]);

  if (validValue.length === 0) return emptyFormatter || null;
  return (
    <>
      <div className={classnames('sea-metadata-ui cell-formatter-container link-formatter', className)} title={validValueTitles}>
        {validValue.map(v => (<LinkItem value={v} key={v} metadata={metadata} onClick={() => handleExpand(v)} />))}
      </div>
      {isShowDetailsDialog && (
        <ResourceDetailsDialog
          isShowIcon={true}
          projectUuid={projectUuid}
          resource={currentLinkItem}
          switchResource={validValue.length > 1 ? switchLinkItem : null}
          onToggle={handleCloseExpand}
        />
      )}
    </>
  );
};


export default LinkFormatter;
