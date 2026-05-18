import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { LongTextInlineEditor, EventBus, EXTERNAL_EVENTS, getPreviewContent } from '@seafile/seafile-editor';
import { Button, Input, Label } from 'reactstrap';
import classnames from 'classnames';
import { gettext, lang, LONG_TEXT_EXCEED_LIMIT_MESSAGE } from '@/constants';
import { isLongTextValueExceedLimit } from '@/utils/long-text';
import { toaster } from '@/components';
import UploadFilesButton from '../../../../tickets/components/upload-files-btn';
import TagsSettings from '@/project/main-panel/tags/tags-settings';
import { useTags } from '@/project/hooks';

import './index.css';

const EditKnowledge = ({ knowledge, editorAPI, onChange, toggleKBRecordPreview, onLinkClick }) => {
  const [title, setTitle] = useState(knowledge?.title || '');
  const [content, setContent] = useState({ text: knowledge?.content || '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [tags, setTags] = useState(knowledge?.tags || []);

  const contentEditorRef = useRef(null);
  const knowledgeRef = useRef(null);

  const { tagsData, createTag } = useTags();

  const disabled = useMemo(() => {
    return (!title || !title.trim()) || (!content || !content.text.trim()) || isSubmitting;
  }, [title, content, isSubmitting]);

  const onTitleChange = useCallback((event) => {
    const newTitle = event.target.value;
    if (newTitle === title) return;
    setTitle(newTitle);
  }, [title]);

  const onContentChange = useCallback((value) => {
    if (isLongTextValueExceedLimit(value)) {
      toaster.closeAll();
      toaster.danger(LONG_TEXT_EXCEED_LIMIT_MESSAGE, { duration: null });
      return;
    }
    let normalized = value || { text: '' };
    if (typeof normalized !== 'object') normalized = { text: normalized || '' };
    const { previewText, images, links, checklist } = getPreviewContent(normalized.text || '', true, false);
    normalized.preview = normalized.preview || previewText || '';
    normalized.images = (Array.isArray(normalized.images) && normalized.images.length > 0) ? normalized.images : (images || []);
    normalized.links = (Array.isArray(normalized.links) && normalized.links.length > 0) ? normalized.links : (links || []);
    normalized.checklist = normalized.checklist || checklist || { total: 0, completed: 0 };
    setContent(normalized);
  }, []);

  const handleFiles = useCallback((files) => {
    if (files.length === 0) return;
    const editor = contentEditorRef.current.getEditor();
    const eventBus = EventBus.getInstance();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImage = /image/i.test(file.type);
      const fileName = file.name;
      editorAPI.uploadLocalImage(file).then(url => {
        eventBus.dispatch(EXTERNAL_EVENTS.INSERT_ATTACHMENTS, editor, { title: fileName, url, isImage });
      });
    }
  }, [editorAPI]);

  const onCancel = useCallback(() => {
    toggleKBRecordPreview && toggleKBRecordPreview(true);
  }, [toggleKBRecordPreview]);

  const onSubmit = useCallback(() => {
    setIsSubmitting(true);
    const validTitle = title.trim();
    const text = (content && typeof content === 'object') ? (content.text || '') : (content || '');
    const { previewText, images, links, checklist } = getPreviewContent(text, true, false);
    const normalizedContent = {
      text,
      preview: previewText || '',
      images: images || [],
      links: links || [],
      checklist: checklist || { total: 0, completed: 0 },
    };
    onChange && onChange({ title: validTitle, content: normalizedContent, tags: tags || [] }, (error) => {
      if (error) {
        setIsSubmitting(false);
        return;
      }
      onCancel();
    });
  }, [title, content, tags, onChange, onCancel]);

  useEffect(() => {
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
  }, []);

  const renderSubmitBtns = useCallback((className = 'ml-2') => {
    return (
      <div className={className}>
        <Button className="mr-4" onClick={onCancel}>{gettext('Cancel')}</Button>
        <Button onClick={onSubmit} color="primary" disabled={disabled}>{gettext('Submit')}</Button>
      </div>
    );
  }, [disabled, onCancel, onSubmit]);

  // 892: comment min-width(584) + others min-width(260) + gap: 16 * 3
  const isSmallScreen = containerWidth < 892;

  return (
    <div className={classnames('seaqa-project-edit-knowledge', { 'small': isSmallScreen })} ref={knowledgeRef}>
      <div className="seaqa-project-knowledge-settings">
        <div className="seaqa-project-knowledge-settings-container">
          <div className="seaqa-project-knowledge-content-settings">
            <div className="seaqa-project-knowledge-title mb-4">
              <Label>
                {gettext('Title')}
                <span className="required-tip" title={gettext('Required')}>{'*'}</span>
              </Label>
              <Input autoFocus disabled={isSubmitting} value={title} onChange={onTitleChange} />
            </div>
            <div className="seaqa-project-knowledge-content mb-4">
              <Label>
                {gettext('Content')}
                <span className="required-tip" title={gettext('Required')}>{'*'}</span>
              </Label>
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
                onSaveEditorValue={onContentChange}
                onLinkClick={onLinkClick}
              />
            </div>
            <div className="seaqa-project-knowledge-footer">
              <UploadFilesButton onChange={handleFiles} />
              {!isSmallScreen && renderSubmitBtns()}
            </div>
          </div>
          <div className="seaqa-project-knowledge-other-settings">
            <TagsSettings
              value={tags}
              isLoading={false}
              tagsData={tagsData}
              createTag={createTag}
              onChange={setTags}
            />
          </div>
          {isSmallScreen && renderSubmitBtns('seaqa-project-knowledge-submit-btns')}
        </div>
      </div>
    </div>
  );

};

export default EditKnowledge;
