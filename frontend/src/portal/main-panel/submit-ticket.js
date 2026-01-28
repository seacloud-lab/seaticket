import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { Button, Input, Label } from 'reactstrap';
import classnames from 'classnames';
import { LongTextInlineEditor } from '@seafile/seafile-editor';
import { gettext, lang, server, LONG_TEXT_EXCEED_LIMIT_MESSAGE } from '@/constants';
import { isLongTextValueExceedLimit } from '@/utils/long-text';
import LongTextEditorUtilities from '@/utils/long-text';
import { CenteredLoading, toaster, Option, OptionEditor } from '@/components';
import { portalAPI } from '../api';
import { PORTAL_PAGE } from '../constants';

import './submit-ticket.css';

const PortalTypeSettings = ({ id, isReadonly, value, typesData, onChange, className = 'mb-4' }) => {
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
      <div className={classnames('sea-qa-project-ticket-settings-item', className)}>
        <Label>{gettext('Type')}</Label>
        <div className="ticket-types-formatter" onClick={openEditor} ref={editorRef}>
          {typeOption ? (<Option option={typeOption} />) : (<div className="tip-default">{gettext('No type')}</div>)}
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

const SubmitTicket = ({ projectUuid, onPageChange, typesData, isMetadataLoading }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const ticketRef = useRef(null);

  const longtextAPI = useMemo(() => new LongTextEditorUtilities({ server, api: {
    uploadFile: (...params) => portalAPI.uploadFile(projectUuid, ...params)
  } }), [projectUuid]);

  useEffect(() => {
    if (isMetadataLoading) return;
    setIsLoading(false);
  }, [isMetadataLoading]);

  useEffect(() => {
    if (isLoading) return;
    const ticketDom = ticketRef.current;
    const handleResize = () => {
      if (!ticketDom) return;
      setContainerWidth(ticketDom.offsetWidth);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    ticketDom && resizeObserver.observe(ticketDom);
    return () => {
      ticketDom && resizeObserver.unobserve(ticketDom);
    };
  }, [isLoading]);

  const onTitleChange = useCallback((event) => {
    setTitle(event.target.value);
  }, []);

  const onContentChange = useCallback((value) => {
    if (isLongTextValueExceedLimit(value)) {
      toaster.closeAll();
      toaster.danger(LONG_TEXT_EXCEED_LIMIT_MESSAGE, { duration: null });
      return;
    }
    setContent(value);
  }, []);

  const onTypeChange = useCallback((typeId) => {
    setType(typeId);
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
      const typeOption = typesData.rows.find(t => t._id === type);
      typeName = typeOption?.name || '';
    }

    const data = {
      title: validTitle,
      content,
      type: typeName || undefined,
    };

    portalAPI.createTicket(projectUuid, data).then(() => {
      toaster.success(gettext('Ticket submitted successfully'));
      setTitle('');
      setContent('');
      setType('');
      onPageChange(PORTAL_PAGE.MY_TICKETS);
    }).catch(error => {
      const errorMessage = error.response?.data?.error_msg || gettext('Failed to submit ticket');
      toaster.danger(errorMessage);
    }).finally(() => {
      setIsSubmitting(false);
    });
  }, [title, content, type, typesData, projectUuid, onPageChange]);

  const disabled = useMemo(() => {
    return (!title || !title.trim()) || (!content || !content.text?.trim()) || isSubmitting;
  }, [title, content, isSubmitting]);

  const renderSubmitBtns = useCallback((className = 'ml-2') => {
    return (
      <div className={className}>
        <Button onClick={onSubmit} color="primary" disabled={disabled}>
          {isSubmitting ? gettext('Submitting...') : gettext('Submit')}
        </Button>
      </div>
    );
  }, [disabled, isSubmitting, onSubmit]);

  if (isLoading) {
    return <CenteredLoading />;
  }

  const isSmallScreen = containerWidth < 700;

  return (
    <div className={classnames('sea-qa-project-new-ticket', { 'small': isSmallScreen })} ref={ticketRef}>
      <div className="sea-qa-project-ticket-settings">
        <div className="sea-qa-project-ticket-name mb-3">{gettext('New ticket')}</div>
        <div className="sea-qa-project-ticket-settings-container">
          <div className="sea-qa-project-ticket-content-settings">
            <div className="sea-qa-project-ticket-title mb-4">
              <Label>
                {gettext('Title')}
                <span className="required-tip" title={gettext('Required')}>{'*'}</span>
              </Label>
              <Input autoFocus disabled={isSubmitting} value={title} onChange={onTitleChange} />
            </div>
            <div className="sea-qa-project-ticket-content mb-4">
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
                isCheckBrowser={true}
                isImageUploadOnly={false}
                isSupportMultipleFiles={true}
                editorApi={longtextAPI}
                autoFocus={false}
                onSaveEditorValue={onContentChange}
              />
            </div>
            {typesData.rows.length > 0 && (
              <PortalTypeSettings
                id="portal-type-editor-popover"
                isReadonly={isSubmitting}
                value={type}
                typesData={typesData}
                onChange={onTypeChange}
              />
            )}
            <div className="sea-qa-project-ticket-footer">
              {!isSmallScreen && renderSubmitBtns()}
            </div>
          </div>
          {isSmallScreen && renderSubmitBtns('sea-qa-project-ticket-submit-btns')}
        </div>
      </div>
    </div>
  );
};

export default SubmitTicket;
