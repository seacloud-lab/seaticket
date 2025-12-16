import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dropdown, DropdownItem } from 'reactstrap';
import { Icon, IconButton, SubDropdown,
  CustomizeDropdownMoreToggle, CustomizeDropdownItem, CustomizeDropdownMenu
} from '@/components';
import { gettext } from '@/constants';
import context from '../../../context';
import { isFunction } from '@/utils/type-detection';

const RowsToolbar = ({ rows, columns, selectNone, deleteRow, deleteRows, modifyRows, createTools, updateLocalRow, deleteLocalRows }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubOpen, setIsSubOpen] = useState(false);
  const [subMenuKey, setSubMenuKey] = useState('');

  const rowIds = useMemo(() => rows.map(r => r._id), [rows]);

  const handleDeleteRows = useCallback((event) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    deleteRows && deleteRows(rowIds);
    selectNone();
  }, [deleteRows, rowIds, selectNone]);

  const handleDeleteRow = useCallback((event) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    deleteRow && deleteRow(rowIds[0]);
    selectNone();
  }, [deleteRow, rowIds, selectNone]);

  const onMoreToggle = useCallback((event) => {
    event && event.preventDefault();
    event && event.stopPropagation();
    event?.nativeEvent && event.nativeEvent.stopImmediatePropagation();
    setIsOpen(!isOpen);
    if (isOpen) {
      setIsSubOpen(false);
      setSubMenuKey('');
    }
  }, [isOpen]);

  const openSubMenu = useCallback((event, subMenu) => {
    event && event.stopPropagation();
    event?.nativeEvent && event.nativeEvent.stopImmediatePropagation();
    setSubMenuKey(subMenu.key);
    setIsSubOpen(true);
  }, []);

  const onSubMenuToggle = useCallback((event, subMenu) => {
    event && event.stopPropagation();
    event?.nativeEvent && event.nativeEvent.stopImmediatePropagation();
    setIsSubOpen(!isSubOpen);
    setSubMenuKey(subMenu?.key || '');
  }, [isSubOpen]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('contextmenu', () => onMoreToggle());
    return () => {
      document.removeEventListener('contextmenu', () => onMoreToggle());
    };
  }, [isOpen, onMoreToggle]);

  return (
    <div className="sea-metadata-views sea-metadata-rows-tools">
      <div className="sea-qa-icon-btn sea-metadata-rows-tool-btn pl-2 pr-2 mr-2" onClick={selectNone}>
        <Icon symbol="x" className="mr-2" />
        <span className="color-default">{gettext('{count} selected').replace('{count}', rowIds.length)}</span>
      </div>
      {(rowIds.length > 1 && context.canDeleteRows()) && (
        <IconButton icon="delete" title={gettext('Delete')} className="mr-2" onClick={handleDeleteRows} />
      )}
      {(rowIds.length === 1 && context.canDeleteRow()) && (
        <IconButton icon="delete" title={gettext('Delete')} className="mr-2" onClick={handleDeleteRow} />
      )}

      {isFunction(createTools) && createTools({ rows, columns, modifyRows, updateLocalRow, deleteLocalRows, selectNone }).map(tool => {
        const { key, label, icon, callback, children } = tool;
        if (key !== 'more') {
          return (<IconButton icon={icon} key={key} title={label} className="mr-2" onClick={callback} />);
        }
        if (!Array.isArray(children) || children.length === 0) return null;
        return (
          <Dropdown
            key={key}
            isOpen={isOpen}
            className="sea-metadata-manage-dropdown"
            toggle={onMoreToggle}
          >
            <CustomizeDropdownMoreToggle />
            <CustomizeDropdownMenu fixed={true}>
              {children.map(item => {
                const { key: childKey, label: childName, callback: childCallback } = item;
                if (childKey === 'divider') {
                  return (<DropdownItem key={childKey} divider />);
                }
                if (Array.isArray(item.children) && item.children.length > 0) {
                  return (
                    <SubDropdown
                      key={childKey}
                      isOpen={isSubOpen && subMenuKey === childKey}
                      menu={item}
                      onShow={openSubMenu}
                      onToggle={onSubMenuToggle}
                    />
                  );
                }
                return (
                  <CustomizeDropdownItem key={childKey} onMouseEnter={onSubMenuToggle} onClick={(event) => childCallback && childCallback(event)}>
                    {childName}
                  </CustomizeDropdownItem>
                );
              })}
            </CustomizeDropdownMenu>
          </Dropdown>
        );
      })}
    </div>

  );
};

export default RowsToolbar;
