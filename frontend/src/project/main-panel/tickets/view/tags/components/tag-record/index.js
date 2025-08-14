import React, { useCallback, useState } from 'react';
import { Dropdown, DropdownMenu, DropdownItem } from 'reactstrap';
import { Icon, CustomizeDropdownMoreToggle, CommonOperationConfirmationDialog } from '@/components';
import Tag from '../tag';
import { gettext } from '@/constants';

import './index.css';

const TagRecord = ({ tag, editTag, deleteTag }) => {
  const [isShowDropdown, setIsShowDropdown] = useState(false);
  const [isShowDeleteConfirmationDialog, setIsShowDeleteConfirmationDialog] = useState(false);

  const toggleDropdown = useCallback(() => {
    setIsShowDropdown(!isShowDropdown);
  }, [isShowDropdown]);

  const openDeleteConfirmationDialog = useCallback(() => {
    setIsShowDeleteConfirmationDialog(true);
  }, []);

  const closeDeleteConfirmationDialog = useCallback(() => {
    setIsShowDeleteConfirmationDialog(false);
  }, []);

  if (!tag) return null;

  const { id, name, description, tickets_count, is_predefined } = tag;
  return (
    <>
      <div key={id} className="sea-qa-project-tag-record">
        <div className="sea-qa-project-tag-record-name">
          <Tag tag={tag} />
        </div>
        <div className="sea-qa-project-tag-record-description" title={description}>
          {description}
        </div>
        <div className="sea-qa-project-tag-record-tickets-count">
          {tickets_count > 0 && (
            <div className="h-100 w-100 d-flex align-items-center">
              <Icon symbol="circle-dot" className="mr-1" />
              {tickets_count}
            </div>
          )}
        </div>
        <div className="sea-qa-project-tag-record-op">
          {!is_predefined && (editTag || deleteTag) && (
            <Dropdown isOpen={isShowDropdown} toggle={toggleDropdown} className="sea-qa-project-tag-record-dropdown">
              <CustomizeDropdownMoreToggle isOpen={isShowDropdown} className="w-5 h-5" />
              <DropdownMenu className="sea-qa-dropdown-menu dropdown-menu my-1 mr-2">
                {editTag && (
                  <DropdownItem onClick={() => editTag(tag)}>
                    <Icon symbol="rename" />
                    {gettext('Edit')}
                  </DropdownItem>
                )}
                {deleteTag && (
                  <DropdownItem onClick={openDeleteConfirmationDialog}>
                    <Icon symbol="delete" />
                    {gettext('Delete')}
                  </DropdownItem>
                )}
              </DropdownMenu>
            </Dropdown>
          )}
        </div>
      </div>
      {isShowDeleteConfirmationDialog && (
        <CommonOperationConfirmationDialog
          title={gettext('Delete tag')}
          message={gettext('Are you sure you want to delete {placeholder} tag?').replace('{placeholder}', `<b>${name}</b>`)}
          executeOperation={() => deleteTag(id)}
          confirmBtnText={gettext('Delete')}
          toggleDialog={closeDeleteConfirmationDialog}
        />
      )}
    </>
  );
};

export default TagRecord;
