import React, { useState, useCallback, useRef, useMemo } from 'react';
import { gettext } from '@/constants';
import { Icon, IconTooltip, OptionEditor } from '@/components';
import { getConnectionIcon } from '@/project/main-panel/connections/utils';
import { useConnections } from '@/project/main-panel/connections/hooks';

import './index.css';

const ConnectionSetting = ({ selectedConnections, onConnectionsChange, onRemoveConnection }) => {
  const { connections } = useConnections();
  const [isShowPopover, setIsShowPopover] = useState(false);
  const [selectedConnectionIds, setSelectedConnectionIds] = useState([]);
  const popoverRef = useRef(null);

  const option = useMemo(() => {
    return connections.map((item) => {
      return {
        label: (
          <>
            <img src={getConnectionIcon(item.type)} alt="" className="analyze-connection-img" />
            <span>{item.name}</span>
          </>
        ),
        name: item.name,
        value: item.id,
      };
    });
  }, [connections]);

  const value = useMemo(() => {
    return selectedConnections.map((item) => item.id);
  }, [selectedConnections]);

  const onChange = useCallback((value) => {
    setSelectedConnectionIds(value);
  }, []);

  const closeEditor = useCallback(() => {
    if (!isShowPopover) return;

    const currentIds = value.sort();
    const tempIds = selectedConnectionIds.sort();
    const hasChanged = currentIds.length !== tempIds.length || currentIds.some((id, index) => id !== tempIds[index]);
    if (hasChanged) {
      const newSelectedConnections = connections.filter(item => selectedConnectionIds.includes(item.id));
      onConnectionsChange(newSelectedConnections);
    }
    setIsShowPopover(false);
  }, [isShowPopover, value, selectedConnectionIds, onConnectionsChange, connections]);

  const handleTogglePopover = useCallback(() => {
    if (!isShowPopover) {
      setIsShowPopover(true);
    }
  }, [isShowPopover]);

  return (
    <>
      {selectedConnections.length > 0 && (
        <div className="analyze-selected-connections">
          {selectedConnections.map(connection => (
            <div key={connection.id} className="analyze-connection-tag">
              <img src={getConnectionIcon(connection.type)} alt="" className="analyze-tag-icon" />
              <span className="analyze-tag-name">{connection.name}</span>
              <IconTooltip
                icon="close"
                className="analyze-tag-remove"
                tip={gettext('Remove')}
                placement="bottom"
                onClick={() => onRemoveConnection(connection.id)}
              />
            </div>
          ))}
        </div>
      )}
      <div className="analyze-add-connection" ref={popoverRef}>
        <div className="analyze-add-btn" onClick={handleTogglePopover}>
          <Icon symbol="plus" className="analyze-add-icon" />
          <span>{gettext('Add connections')}</span>
        </div>
        {isShowPopover && (
          <OptionEditor
            className="analyze-connection-popover"
            optionClassName="analyze-popover-item"
            options={option}
            target={popoverRef}
            checkPlacement="left"
            isSearchEnabled={false}
            isMultiple={true}
            optionHeight={32}
            value={value}
            onChange={onChange}
            onToggle={closeEditor}
          />
        )}
      </div>
    </>
  );
};

export default ConnectionSetting;
