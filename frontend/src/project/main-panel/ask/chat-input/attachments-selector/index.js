import React, { useCallback, useState, useRef } from 'react';
import { Dropdown, DropdownToggle } from 'reactstrap';
import {
  CustomizeDropdownItem, CustomizeDropdownMenu, CustomizeDropdownItemIcon, CustomizeDropdownItemText,
  Icon, SyncOptionEditor, Tooltip
} from '@/components';
import { gettext } from '@/constants';
import { searchAPI } from '@/project/api';
import { AttachmentObject } from '@/project/main-panel/ask/models';
import { CHAT_ATTACHMENT_TYPE, CHAT_IMAGE_ATTACHMENT_MAX_COUNT } from '../../constants';

import './index.css';

const AttachmentsSelector = ({
  projectUuid,
  attachments = [],
  onChange: propsOnChange,
  onFileInputClick,
  canAddSources = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const attachmentsRef = useRef([]);
  const ref = useRef(null);

  const [isShowSelector, setIsShowSelector] = useState(false);

  const openSelector = useCallback(() => {
    setIsShowSelector(true);
  }, []);

  const onToggle = useCallback(() => {
    setIsShowSelector(false);
  }, []);

  const onSearch = useCallback((value, signal) => {
    return searchAPI.searchTicketsAndDocuments(projectUuid, value, signal).then(res => {
      const newResults = Array.isArray(res.data.results) ? res.data.results.map(res => new AttachmentObject(res)) : [];
      attachmentsRef.current = [...attachments, ...newResults];
      return newResults.map(res => ({
        value: res.key,
        icon: res.icon,
        label: res.title,
      }));
    });
  }, [projectUuid, attachments]);

  const onChange = useCallback((newAttachmentKeys) => {
    const newAttachments = newAttachmentKeys.map(key => {
      if (key.startsWith('image')) return attachments.find(t => t.key === key);
      return attachmentsRef.current.find(t => t.key === key);
    });
    propsOnChange && propsOnChange(newAttachments);
  }, [attachments, propsOnChange]);

  const value = Array.isArray(attachments) ? attachments.map(t => t.key) : [];
  const images = Array.isArray(attachments) ? attachments.filter(v => v.type === CHAT_ATTACHMENT_TYPE.IMAGE) : [];

  return (
    <>
      <Dropdown isOpen={isOpen} direction="up" className="active-status-editor" toggle={() => setIsOpen(!isOpen)}>
        <DropdownToggle
          className="seaqa-ask-chat-attachments-selector seaqa-icon-btn border d-flex align-items-center"
          tag="div"
          innerRef={ref}
          id="seaqa-ask-chat-attachments-selector"
        >
          <Icon symbol="plus" />
        </DropdownToggle>
        {ref.current && (
          <Tooltip target={ref} placement="top-start">
            {gettext('Add attachments')}
          </Tooltip>
        )}
        <CustomizeDropdownMenu fixed={true} modifiers={[{ name: 'preventOverflow', options: { boundary: document.body } }]}>
          {canAddSources && (
            <CustomizeDropdownItem onClick={openSelector}>
              <CustomizeDropdownItemIcon symbol="plus" />
              <CustomizeDropdownItemText>{gettext('Add tickets and docs')}</CustomizeDropdownItemText>
            </CustomizeDropdownItem>
          )}
          <CustomizeDropdownItem onClick={onFileInputClick} disabled={images.length >= CHAT_IMAGE_ATTACHMENT_MAX_COUNT} >
            <CustomizeDropdownItemIcon symbol="image"/>
            <CustomizeDropdownItemText>{gettext('Upload image')}</CustomizeDropdownItemText>
          </CustomizeDropdownItem>
        </CustomizeDropdownMenu>
      </Dropdown>
      {canAddSources && isShowSelector && (
        <SyncOptionEditor
          className="seaqa-ai-chat-selector-display-editor "
          target={ref}
          isMultiple={true}
          placeholder={gettext('Search')}
          emptyTip={gettext('No results')}
          value={Array.isArray(value) ? value : []}
          placement="top-start"
          onChange={onChange}
          onToggle={onToggle}
          onSearch={onSearch}
        />
      )}
    </>
  );
};

export default AttachmentsSelector;
