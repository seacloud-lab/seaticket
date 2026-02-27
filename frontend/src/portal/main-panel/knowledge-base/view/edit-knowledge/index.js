import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { LongTextInlineEditor } from '@seafile/seafile-editor';
import { Input, Label } from 'reactstrap';
import classnames from 'classnames';
import { name, avatarURL, username, gettext, lang } from '@/constants';
import { CenteredLoading, toaster } from '@/components';
import { KB_TABLE_NAME, KNOWLEDGE_PAGE_SLUG_ID } from '../../constants';
import { Utils } from '@/utils/utils';
import { knowledgeBaseAPI } from '@/project/api';
import { usePortalKnowledgePage } from '../../hooks/knowledge-page';
import TagsSettings from '@/project/main-panel/tags/tags-settings';
import { useData, useTags } from '@/project/hooks';
import { convertRowToKeyValue } from '@/sea-metadata/utils/row';

import './index.css';

const PortalEditKnowledge = ({ editorAPI, projectUuid }) => {
  const { modifyLocalRow, getTableByName } = useData();
  const { tagsData, createTag } = useTags();
  const { pageSlugId } = usePortalKnowledgePage();

  const [isLoading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState({ text: '' });
  const [containerWidth, setContainerWidth] = useState(0);
  const [tags, setTags] = useState([]);

  const contentEditorRef = useRef(null);
  const knowledgeRef = useRef(null);
  const lastRecordId = useRef('');

  const user = useMemo(() => {
    return {
      name,
      username,
      avatar_url: avatarURL
    };
  }, []);

  const handleUpdateRowsCacheData = useCallback((ticketID, update) => {
    const table = getTableByName(KB_TABLE_NAME);
    const columns = Object.values(table.key_column_map);
    if (columns.length === 0) return;
    modifyLocalRow(KB_TABLE_NAME, ticketID, convertRowToKeyValue(update, { data: { columns }, tagsData }));
  }, [tagsData, getTableByName, modifyLocalRow]);

  useEffect(() => {
    if (Object.values(KNOWLEDGE_PAGE_SLUG_ID).includes(pageSlugId)) return;
    if (lastRecordId.current === pageSlugId) return;
    lastRecordId.current = pageSlugId;
    setLoading(true);
    knowledgeBaseAPI.getRecord(projectUuid, pageSlugId).then(res => {
      handleUpdateRowsCacheData(pageSlugId, res?.data.record);
      const { title = '', content = '', tags = [] } = res?.data.record || {};
      setTitle(title);
      setContent({ text: content || '' });
      setTags(tags);
      setLoading(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setLoading(false);
    });
  }, [projectUuid, pageSlugId, handleUpdateRowsCacheData]);

  useEffect(() => {
    if (isLoading) return;
    const knowledgeDom = knowledgeRef.current;
    const handleResize = () => {
      if (!knowledgeDom) return;
      setContainerWidth(knowledgeDom.offsetWidth);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    knowledgeDom && resizeObserver.observe(knowledgeDom);

    return () => {
      knowledgeDom && resizeObserver.unobserve(knowledgeDom);
    };
  }, [isLoading]);

  if (isLoading) return (<CenteredLoading />);

  // 892: comment min-width(584) + others min-width(260) + gap: 16 * 3
  const isSmallScreen = containerWidth < 892;

  return (
    <div className={classnames('sea-qa-portal-edit-knowledge', { 'small': isSmallScreen })} ref={knowledgeRef}>
      {!isSmallScreen && (
        <div className="sea-qa-portal-knowledge-user">
          <img src={user.avatar_url} alt={user.name} />
        </div>
      )}
      <div className="sea-qa-portal-knowledge-settings">
        <div className="sea-qa-portal-knowledge-name mb-3">{gettext('Record')}</div>
        <div className="sea-qa-portal-knowledge-settings-container">
          <div className="sea-qa-portal-knowledge-content-settings">
            <div className="mb-4">
              <Label>{gettext('Title')}</Label>
              <Input autoFocus readOnly={true} value={title} onChange={() => {}} />
            </div>
            <div className="sea-qa-portal-knowledge-content mb-4">
              <Label>{gettext('Content')}</Label>
              <LongTextInlineEditor
                isAlwaysEnableEdit={true}
                ref={contentEditorRef}
                lang={lang}
                headerName={gettext('Content')}
                value={content}
                autoSave={true}
                saveDelay={20 * 1000}
                isCheckBrowser={true}
                isImageUploadOnly={false}
                isSupportMultipleFiles={true}
                editorApi={editorAPI}
                autoFocus={false}
                onSaveEditorValue={() => {}}
              />
            </div>
          </div>
          <div className="sea-qa-portal-knowledge-other-settings">
            <TagsSettings
              isReadonly={true}
              value={tags}
              isLoading={false}
              tagsData={tagsData}
              createTag={createTag}
              onChange={setTags}
            />
          </div>
        </div>
      </div>
    </div>
  );

};

export default PortalEditKnowledge;
