import React, { useMemo, useState, useCallback } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { CustomizeLabel, IconTooltip } from '@/components';
import { useConnections } from '@/project/main-panel/connections/hooks';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import { TICKET_TABLE_NAME, TICKET_TYPE, TICKET_STATE } from '@/project/main-panel/tickets/constants';
import { getConnectionIcon } from '@/project/main-panel/connections/utils';

import './index.css';

const { projectUuid } = window.app.pageOptions;

const LinkSettings = ({ value, className = 'mb-4', linkedRecords }) => {

  const { connections } = useConnections();
  const [isShowDetailsDialog, setIsShowDetailsDialog] = useState(false);
  const [currentLinkItem, setCurrentLinkItem] = useState(null);

  const validValue = useMemo(() => {
    return value.map(v => {
      const { title, issue_type, state } = linkedRecords[v] || {};
      return {
        key: v,
        title,
        type: issue_type,
        state
      };
    }).filter(item => item.title);
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

  const renderTypeImage = (type) => {
    if (!type) return null;
    return (
      <img src={getConnectionIcon(type)} alt="" className="connection-icon" />
    );
  };

  const renderStateIcon = (state) => {
    if (!state) return null;
    return state === TICKET_STATE.OPEN ? (
      <IconTooltip icon="dot-circle-stroked" tip={gettext('Open')} placement="bottom" />
    ) : (
      <IconTooltip icon="check-circle-stroked" tip={gettext('Closed')} placement="bottom" />
    );
  };

  return (
    <div className={classnames('sea-ticket-settings-item', className)}>
      <CustomizeLabel icon="link">{gettext('Linked records')}</CustomizeLabel>
      <div className="link-settings-content">
        {validValue.map(({ key, title, type, state }) => (
          <div className="link-item" key={key} onClick={() => handleExpand(key)}>
            {renderTypeImage(type)}
            <span className="link-item-name" title={title}>{title}</span>
            {renderStateIcon(state)}
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
