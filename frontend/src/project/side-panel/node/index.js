import React, { useCallback, useState } from 'react';
import classnames from 'classnames';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { gettext } from '../../../constants';
import Icon from '../../../components/icon';
import CommonOperationConfirmationDialog from '../../../components/dialog/common-operation-confirmation-dialog';

import './index.css';

const Node = ({ node, level, activeNode, onClick, onCreate, onDelete, onEdit }) => {
  const [isShowDropdown, setIsShowDropdown] = useState(false);
  const [isShowConfirmationDialog, setIsShowConfirmationDialog] = useState(false);

  const toggleDropdown = useCallback((event) => {
    event && event.nativeEvent && event.nativeEvent.stopImmediatePropagation();
    event && event.stopPropagation();
    setIsShowDropdown(!isShowDropdown);
  }, [isShowDropdown]);

  const openDeleteConfirmationDialog = useCallback(() => {
    setIsShowConfirmationDialog(true);
  }, []);

  const closeDeleteConfirmationDialog = useCallback(() => {
    setIsShowConfirmationDialog(false);
  }, []);

  const handleDelete = useCallback(() => {
    onDelete && onDelete(node.key);
  }, [node, onDelete]);

  const { key, name, editable, icon } = node;
  return (
    <>
      <div
        className={classnames('sea-qa-project-navigation-node', {
          'sea-qa-project-navigation-node-level0': level === 0,
          'sea-qa-project-navigation-node-level1': level === 1,
          'sea-qa-project-navigation-node-level': level > 1,
          'sea-qa-project-navigation-node-active': key === activeNode?.key,
        })}
        style={{ paddingLeft: level > 1 ? (level - 1) * 20 + 8 : 8 }}
        onClick={() => onClick(node)}
      >
        {icon && (<Icon symbol={icon} className="sea-qa-project-navigation-node-icon" />)}
        <span className="sea-qa-project-navigation-node-name">{name}</span>
        {editable && (onCreate || onEdit || onDelete) && (
          <Dropdown
            isOpen={isShowDropdown}
            toggle={toggleDropdown}
            direction="down"
            className="sea-qa-project-navigation-node-more-operation"
          >
            <DropdownToggle
              tag="div"
              role="button"
              className="sea-qa-icon-btn sea-qa-project-navigation-node-more-btn"
              title={gettext('More operations')}
              aria-label={gettext('More operations')}
              data-toggle="dropdown"
              aria-expanded={isShowDropdown}
              aria-haspopup={true}
            >
              <Icon symbol="more" />
            </DropdownToggle>
            <DropdownMenu
              className="sea-qa-dropdown-menu dropdown-menu drop-list position-fixed"
              modifiers={[{ name: 'preventOverflow', options: { boundary: document.body } }]}
              container={document.body}
            >
              {onCreate && (<DropdownItem onClick={() => onCreate(node)}>{gettext('Create')}</DropdownItem>)}
              {onEdit && (<DropdownItem onClick={() => onEdit(node)}>{gettext('Edit')}</DropdownItem>)}
              {onDelete && (<DropdownItem onClick={openDeleteConfirmationDialog}>{gettext('Delete')}</DropdownItem>)}
            </DropdownMenu>
          </Dropdown>
        )}
      </div>
      {isShowConfirmationDialog && (
        <CommonOperationConfirmationDialog
          title={gettext('Delete')}
          message={gettext('Are you sure you want to delete {placeholder} ?').replace('{placeholder}', name)}
          executeOperation={handleDelete}
          confirmBtnText={gettext('Delete')}
          toggleDialog={closeDeleteConfirmationDialog}
        />
      )}
    </>
  );
};

export default Node;
