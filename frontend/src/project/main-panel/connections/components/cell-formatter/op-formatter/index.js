import React, { useMemo, useState } from 'react';
import { Dropdown } from 'reactstrap';
import { IconButton, CustomizeDropdownMoreToggle, CustomizeDropdownMenu, CustomizeDropdownItem } from '@/components';
import { gettext } from '@/constants';
import { isFunction } from '@/utils/type-detection';

import './index.css';

const OpFormatter = ({ onModify, onDelete, opOptions, row, column }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const validOpOptions = useMemo(() => {
    const options = opOptions.map(option => {
      if (isFunction(option)) {
        return option(row);
      }
      return option;
    });
    return [
      column.width < 88 && onModify ? {
        key: 'edit',
        label: gettext('Edit'),
        callback: onModify,
      } : null,
      column.width < 88 && onDelete ? {
        key: 'delete',
        label: gettext('Delete'),
        callback: onDelete,
      } : null,
      ...options,
    ].filter(Boolean);
  }, [opOptions, row, column, onModify, onDelete]);

  const toggle = () => {
    setDropdownOpen(!dropdownOpen);
  };

  return (
    <div className="seaqa-customize-table-op-formatter">
      {column.width >= 88 && (
        <>
          {onModify && (
            <IconButton className="bg-color-deep mr-1" title={gettext('Edit')} icon="rename" onClick={() => onModify(row)} />
          )}
          {onDelete && (
            <IconButton className="bg-color-deep mr-1" title={gettext('Delete')} icon="delete" onClick={() => onDelete(row)} />
          )}
        </>
      )}
      {validOpOptions.length > 0 &&
        <Dropdown isOpen={dropdownOpen} toggle={toggle} size="sm">
          <CustomizeDropdownMoreToggle isOpen={dropdownOpen} className="bg-color-deep" />
          <CustomizeDropdownMenu fixed={true}>
            {validOpOptions.map((option) => {
              const { key, label, callback } = option;
              return (
                <CustomizeDropdownItem key={key} onClick={() => callback(row)} >
                  {label}
                </CustomizeDropdownItem>
              );
            })}
          </CustomizeDropdownMenu>
        </Dropdown>
      }
    </div>
  );
};

export default OpFormatter;
