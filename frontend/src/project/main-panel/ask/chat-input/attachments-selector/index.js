import React, { useCallback, useState, useRef } from 'react';
import { Dropdown, DropdownToggle } from 'reactstrap';
import {
  CustomizeDropdownItem, CustomizeDropdownMenu, CustomizeDropdownItemIcon, CustomizeDropdownItemText,
  Icon, OptionEditor, SyncOptionEditor, Tooltip
} from '@/components';
import { gettext } from '@/constants';
import { searchAPI } from '@/project/api';
import { AttachmentObject } from '@/project/main-panel/ask/models';
import { CHAT_ATTACHMENT_TYPE, CHAT_IMAGE_ATTACHMENT_MAX_COUNT, CHAT_SKILLS } from '../../constants';

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
  const [isShowSkillSelector, setIsShowSkillSelector] = useState(false);

  const openSelector = useCallback(() => {
    setIsShowSkillSelector(false);
    setIsShowSelector(true);
  }, []);

  const openSkillSelector = useCallback(() => {
    setIsShowSelector(false);
    setIsShowSkillSelector(true);
  }, []);

  const onToggle = useCallback(() => {
    setIsShowSelector(false);
    setIsShowSkillSelector(false);
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
    const skillAttachments = attachments.filter(t => t?.type === CHAT_ATTACHMENT_TYPE.SKILL);
    const newAttachments = newAttachmentKeys.map(key => {
      if (key.startsWith('image')) return attachments.find(t => t.key === key);
      return attachmentsRef.current.find(t => t.key === key);
    }).filter(Boolean);
    propsOnChange && propsOnChange([...newAttachments, ...skillAttachments]);
  }, [attachments, propsOnChange]);

  const onSkillChange = useCallback((skillId) => {
    const newAttachments = attachments.filter(t => t?.type !== CHAT_ATTACHMENT_TYPE.SKILL);
    if (!skillId) {
      propsOnChange && propsOnChange(newAttachments);
      return;
    }
    const skill = CHAT_SKILLS.find(skill => skill.id === skillId);
    const newSkillAttachment = new AttachmentObject({
      type: CHAT_ATTACHMENT_TYPE.SKILL,
      skill_id: skillId,
      title: skill?.name,
    });
    propsOnChange && propsOnChange([...newAttachments, newSkillAttachment]);
  }, [attachments, propsOnChange]);

  const selectedSkill = attachments.find(t => t?.type === CHAT_ATTACHMENT_TYPE.SKILL);
  const skillOptions = CHAT_SKILLS.map(skill => ({
    value: skill.id,
    label: skill.name,
  }));

  const value = Array.isArray(attachments) ? attachments.filter(t => t?.type !== CHAT_ATTACHMENT_TYPE.SKILL).map(t => t.key) : [];
  const skillValue = selectedSkill?.skill_id || '';
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
          <CustomizeDropdownItem onClick={openSkillSelector}>
            <CustomizeDropdownItemText>{gettext('Skills')}</CustomizeDropdownItemText>
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
      {isShowSkillSelector && (
        <OptionEditor
          className="seaqa-ai-chat-selector-display-editor"
          target={ref}
          isMultiple={false}
          isSearchEnabled={false}
          emptyTip={gettext('No results')}
          options={skillOptions}
          value={skillValue}
          placement="top-start"
          onChange={onSkillChange}
          onToggle={onToggle}
        />
      )}
    </>
  );
};

export default AttachmentsSelector;
