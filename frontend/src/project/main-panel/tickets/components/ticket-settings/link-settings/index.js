import React, { useMemo, useState, useCallback } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { CustomizeLabel } from '@/components';
import { useConnections } from '@/project/main-panel/connections/hooks';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import { TICKET_TABLE_NAME, TICKET_TYPE } from '@/project/main-panel/tickets/constants';

import './index.css';

const { projectUuid } = window.app.pageOptions;

const LinkSettings = ({ value, className = 'mb-4', linkedRecords }) => {

  const { connections } = useConnections();
  const [isShowDetailsDialog, setIsShowDetailsDialog] = useState(false);
  const [currentLinkItem, setCurrentLinkItem] = useState(null);

  const validValue = useMemo(() => {
    return value.map(v => ({ key: v, title: linkedRecords[v] })).filter(item => item.title);
  }, [value, linkedRecords]);

  const initLinkItem = useCallback((linkItem) => {
    // ticket type connection
    if (linkedRecords[linkItem]?.includes(TICKET_TABLE_NAME)) {
      setCurrentLinkItem({ _id: linkItem, connection_id: '', type: TICKET_TYPE, key: linkItem });
      return;
    }
    // other type connection
    const [connectionId, record_id] = linkItem.split('_');
    let validConnectionId = Number(connectionId);
    const connection = connections.find(c => c.id === validConnectionId);
    if (connection) {
      setCurrentLinkItem({ _id: record_id, connection_id: connection.id, type: connection.type, key: linkItem });
    }
  }, [connections, linkedRecords]);

  const switchLinkItem = useCallback((step) => {
    if (!currentLinkItem || validValue.length <= 1) return;

    const index = validValue.findIndex(v => v.key === currentLinkItem.key);
    if (index === -1) return;

    let newIndex = index + step;
    if (newIndex > validValue.length - 1) newIndex = 0;
    if (newIndex < 0) newIndex = validValue.length - 1;

    const nextLinkItem = validValue[newIndex].key;
    initLinkItem(nextLinkItem);
  }, [validValue, currentLinkItem, initLinkItem]);

  const handleExpand = useCallback((linkItem) => {
    initLinkItem(linkItem);
    setIsShowDetailsDialog(true);
  }, [initLinkItem]);

  const handleCloseExpand = useCallback(() => {
    setCurrentLinkItem(null);
    setIsShowDetailsDialog(false);
  }, []);

  return (
    <div className={classnames('sea-qa-project-ticket-settings-item', className)}>
      <CustomizeLabel icon="link">{gettext('Linked records')}</CustomizeLabel>
      <div className="link-settings-content">
        {validValue.map(({ key, title }) => (
          <div className="link-item" key={key}>
            <span className="link-item-name" title={title} onClick={() => handleExpand(key)}>{title}</span>
          </div>
        ))}
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
    </div>
  );
};

export default LinkSettings;
