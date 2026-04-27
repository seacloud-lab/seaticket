import React, { useMemo, useState, useCallback } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { CustomizeLabel, IconTooltip } from '@/components';
import { useConnections } from '@/project/main-panel/connections/hooks';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import { TICKET_TYPE, TICKET_STATE } from '@/project/main-panel/tickets/constants';
import { getConnectionIcon } from '@/project/main-panel/connections/utils';

import './index.css';

const { projectUuid } = window.app.pageOptions;

const LinkSettings = ({ value, className = 'mb-4', linkedRecords }) => {

  const { connections } = useConnections();
  const [isShowDetailsDialog, setIsShowDetailsDialog] = useState(false);
  const [currentLinkItem, setCurrentLinkItem] = useState(null);

  const validValue = useMemo(() => {
    return value.map(v => {
      const { title, connection_type, state } = linkedRecords[v] || {};
      return {
        key: v,
        title,
        type: connection_type,
        state
      };
    }).filter(item => item.title);
  }, [value, linkedRecords]);

  const initLinkItem = useCallback((linkItem) => {
    if (!linkItem) return false;

    // Ticket links are plain ids; connection links use "{connection_id}_{record_id}".
    if (!String(linkItem).includes('_')) {
      setCurrentLinkItem({ _id: linkItem, connection_id: '', type: TICKET_TYPE, key: linkItem });
      return true;
    }

    // other type connection
    const [connectionId, record_id] = linkItem.split('_');
    const validConnectionId = Number(connectionId);
    const connection = connections.find(c => c.id === validConnectionId);
    if (connection) {
      setCurrentLinkItem({ _id: record_id, connection_id: connection.id, type: connection.type, key: linkItem });
      return true;
    }

    return false;
  }, [connections]);

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
    const hasValidLinkItem = initLinkItem(linkItem);
    if (hasValidLinkItem) {
      setIsShowDetailsDialog(true);
    }
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
    // Special handling: The state returned by the API here is open or close, while the state returned elsewhere is 0001 or 0002
    if (state === 'open') return <IconTooltip icon="dot-circle-stroked" tip={gettext('Open')} placement="bottom" />;
    if (state === 'closed') return <IconTooltip icon="check-circle-stroked" tip={gettext('Closed')} placement="bottom" />;
    return null;
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
