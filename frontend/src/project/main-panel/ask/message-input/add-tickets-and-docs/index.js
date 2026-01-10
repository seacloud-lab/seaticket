import React, { useCallback, useRef, useState } from 'react';
import classnames from 'classnames';
import { Icon, SyncOptionsEditor } from '@/components';
import { gettext } from '@/constants';
import { searchAPI } from '@/project/api';
import { AttachmentObject } from '@/project/main-panel/ask/models';

import './index.css';

const AddTicketsAndDocs = ({ projectUuid, value: attachments = [], onChange: propsOnChange }) => {
  const [isShowSelector, setIsShowSelector] = useState(false);

  const ref = useRef();
  const attachmentsRef = useRef([]);

  const openSelector = useCallback(() => {
    setIsShowSelector(true);
  }, []);

  const onSearch = useCallback((value, signal) => {
    return searchAPI.searchTicketsAndDocuments(projectUuid, value, signal).then(res => {
      const newResults = Array.isArray(res.data.results) ? res.data.results.map(res => new AttachmentObject(res)) : [];
      attachmentsRef.current = [...attachments, ...newResults];
      return newResults.map(res => ({
        value: res.key,
        label: (
          <div className="sea-qa-ai-chat-tool-select-ticket-item">
            <Icon symbol={res.icon} className="mr-2" />
            <span className="text-truncate" title={res.title}>
              {res.title}
            </span>
          </div>
        ),
      }));
    });
  }, [projectUuid, attachments]);

  const onChange = useCallback((newAttachmentKeys) => {
    const newAttachments = newAttachmentKeys.map(key => attachmentsRef.current.find(t => t.key === key));
    propsOnChange && propsOnChange(newAttachments);
  }, [propsOnChange]);

  const onToggle = useCallback(() => {
    setIsShowSelector(false);
  }, []);

  return (
    <>
      <div
        className={classnames('sea-qa-select custom-select sea-qa-customize-select', 'sea-qa-ai-chat-tool-select sea-qa-ai-chat-ticket-select')}
        ref={ref}
        onClick={openSelector}
      >
        <div className="selected-option">
          <Icon symbol="plus" />
          <div className="selected-option-show">{gettext('Add tickets and docs')}</div>
        </div>
      </div>
      {isShowSelector && (
        <SyncOptionsEditor
          className="sea-qa-ai-chat-tool-type-select-editor sea-qa-ai-chat-tool-ai-model-select-editor"
          target={ref}
          isMultiple={true}
          checkPlacement="left"
          placeholder={gettext('Search')}
          emptyTip={gettext('No results')}
          value={Array.isArray(attachments) ? attachments.map(t => t.key) : []}
          onChange={onChange}
          onToggle={onToggle}
          onSearch={onSearch}
        />
      )}
    </>
  );

};

export default AddTicketsAndDocs;
