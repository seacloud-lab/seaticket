import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { Button, Input, Label } from 'reactstrap';
import classnames from 'classnames';
import { LongTextInlineEditor } from '@seafile/seafile-editor';
import { gettext, lang, server, LONG_TEXT_EXCEED_LIMIT_MESSAGE } from '@/constants';
import { isLongTextValueExceedLimit, default as LongTextEditorUtilities } from '@/utils/long-text';
import { canCheckSeafileEditorBrowser } from '@/utils/seafile-editor-browser';
import { CenteredLoading, toaster, Option, OptionEditor } from '@/components';
import { portalAPI } from '../api';
import { PORTAL_PAGE } from '../constants';
import { useData, usePortalIssuesMetadata } from '@/project/hooks';
import { PORTAL_ISSUE_TABLE_NAME } from '@/project/main-panel/portal-issues/constants';

import './submit-issue.css';

const IssueTypeSettings = ({ id, isReadonly, value, typesData, onChange }) => {
  const [isShowEditor, setIsShowEditor] = useState(false);
  const editorRef = useRef(null);

  const options = useMemo(() => {
    return typesData?.rows?.map(o => ({
      ...o,
      value: o._id,
    })) || [];
  }, [typesData]);

  const openEditor = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isReadonly) return;
    setIsShowEditor(true);
  }, [isReadonly]);

  const closeEditor = useCallback(() => {
    setIsShowEditor(false);
  }, []);

  const onTypeChange = useCallback((type) => {
    onChange(type);
  }, [onChange]);

  const typeOption = typesData?.rows?.find(t => t._id === value);

  return (
    <>
      <div className="seaqa-portal-ticket-settings-item">
        <Label>{gettext('Type')}</Label>
        <div className="ticket-types-formatter" onClick={openEditor} ref={editorRef}>
          {typeOption ? <Option option={typeOption} /> : <div className="seaqa-tip-default">{gettext('Select type')}</div>}
        </div>
      </div>
      {!isReadonly && isShowEditor && (
        <OptionEditor
          id={id}
          target={editorRef}
          isMultiple={false}
          value={value}
          placeholder={gettext('Search type')}
          emptyTip={gettext('No types')}
          options={options}
          onChange={onTypeChange}
          onToggle={closeEditor}
        />
      )}
    </>
  );
};

const SubmitIssue = ({ projectUuid, onPageChange }) => {
  const { typesData } = usePortalIssuesMetadata();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const issueRef = useRef(null);

  const { insertRow } = useData();

  const longtextAPI = useMemo(() => new LongTextEditorUtilities({ server, api: {
    uploadFile: (...params) => portalAPI.uploadFile(projectUuid, ...params)
  } }), [projectUuid]);
  const canCheckEditorBrowser = useMemo(() => canCheckSeafileEditorBrowser(), []);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const dom = issueRef.current;
    const handleResize = () => {
      if (!dom) return;
      setContainerWidth(dom.offsetWidth);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    dom && resizeObserver.observe(dom);
    return () => {
      dom && resizeObserver.unobserve(dom);
    };
  }, [isLoading]);

  const onTitleChange = useCallback((event) => {
    setTitle(event.target.value);
  }, []);

  const onTypeChange = useCallback((type) => {
    setType(type);
  }, []);

  const onContentChange = useCallback((value) => {
    if (isLongTextValueExceedLimit(value)) {
      toaster.closeAll();
      toaster.danger(LONG_TEXT_EXCEED_LIMIT_MESSAGE, { duration: null });
      return;
    }
    setContent(value);
  }, []);

  const onSubmit = useCallback(() => {
    const validTitle = title.trim();
    if (!validTitle) {
      toaster.danger(gettext('Please enter a title'));
      return;
    }
    if (!content || !content.text?.trim()) {
      toaster.danger(gettext('Please enter content'));
      return;
    }

    setIsSubmitting(true);

    let typeName = '';
    if (type) {
      const typeOption = typesData?.rows?.find(t => t._id === type);
      typeName = typeOption?.name || '';
    }

    const data = {
      title: validTitle,
      content,
    };
    if (typeName) {
      data.type = typeName;
    }

    portalAPI.createIssue(projectUuid, data).then(() => {
      toaster.success(gettext('Issue has been submitted'));
      setTitle('');
      setContent('');
      setType('');
      insertRow(PORTAL_ISSUE_TABLE_NAME);
      setTimeout(() => onPageChange(PORTAL_PAGE.MY_ISSUES), 1);
    }).catch(error => {
      const errorMessage = error.response?.data?.error_msg || gettext('Failed to submit issue');
      toaster.danger(errorMessage);
    }).finally(() => {
      setIsSubmitting(false);
    });
  }, [title, content, type, typesData, projectUuid, onPageChange]);

  const disabled = useMemo(() => {
    return (!title || !title.trim()) || (!content || !content.text?.trim()) || isSubmitting;
  }, [title, content, isSubmitting]);

  if (isLoading) {
    return <CenteredLoading />;
  }

  const isSmallScreen = containerWidth < 800;

  return (
    <div className="seaqa-portal-new-issue-container" ref={issueRef}>
      <div className={classnames('seaqa-portal-new-issue', { 'small': isSmallScreen })}>
        <div className="seaqa-portal-ticket-settings">
          <div className="seaqa-portal-ticket-settings-container d-flex">
            <div className="seaqa-portal-ticket-content-settings">
              <div className="seaqa-portal-ticket-label">
                <Label>
                  {gettext('Title')}
                  <span className="required-tip" title={gettext('Required')}>{'*'}</span>
                </Label>
                <Input autoFocus disabled={isSubmitting} value={title} onChange={onTitleChange} />
              </div>
              <div className="seaqa-portal-ticket-content">
                <Label>
                  {gettext('Content')}
                  <span className="required-tip" title={gettext('Required')}>{'*'}</span>
                </Label>
                <LongTextInlineEditor
                  isAlwaysEnableEdit={true}
                  lang={lang}
                  headerName={gettext('Content')}
                  value={content || ''}
                  autoSave={true}
                  saveDelay={20 * 1000}
                  isCheckBrowser={canCheckEditorBrowser}
                  isImageUploadOnly={false}
                  isSupportMultipleFiles={true}
                  editorApi={longtextAPI}
                  autoFocus={false}
                  onSaveEditorValue={onContentChange}
                />
              </div>
              {typesData?.rows?.length > 0 && (
                <IssueTypeSettings
                  id="portal-issue-type-editor-popover"
                  isReadonly={isSubmitting}
                  value={type}
                  typesData={typesData}
                  onChange={onTypeChange}
                />
              )}
              <div className="seaqa-portal-ticket-footer d-flex justify-content-center">
                <div>
                  <Button onClick={onSubmit} color="primary" disabled={disabled}>
                    {isSubmitting ? gettext('Submitting...') : gettext('Submit')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubmitIssue;
