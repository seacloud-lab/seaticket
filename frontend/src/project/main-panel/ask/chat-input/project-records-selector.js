import React, { useCallback, useRef } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { searchAPI } from '@/project/api';
import { AttachmentObject } from '@/project/main-panel/ask/models';
import { SyncSelector } from '../components';

const ProjectRecordsSelector = ({ projectUuid, value: attachments = [], isSimple, onChange: propsOnChange }) => {
  const attachmentsRef = useRef([]);

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
    const newAttachments = newAttachmentKeys.map(key => attachmentsRef.current.find(t => t.key === key));
    propsOnChange && propsOnChange(newAttachments);
  }, [propsOnChange]);

  return (
    <SyncSelector
      icon="plus"
      className={classnames('sea-qa-ask-chat-records-selector', { 'simple': isSimple })}
      value={Array.isArray(attachments) ? attachments.map(t => t.key) : []}
      onSearch={onSearch}
      onChange={onChange}
    >
      {gettext('Add tickets and docs')}
    </SyncSelector>
  );

};

export default ProjectRecordsSelector;
