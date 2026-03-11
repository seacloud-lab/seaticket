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
import { useData } from '@/project/hooks';

import './submit-ticket.css';
import { TICKET_TABLE_NAME } from '@/project/main-panel/tickets/constants';

const PortalTypeSettings = ({ id, isReadonly, value, typesData, onChange }) => {
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
      <div className="sea-qa-portal-ticket-settings-item">
        <Label>{gettext('Type')}</Label>
        <div className="ticket-types-formatter" onClick={openEditor} ref={editorRef}>
          {typeOption ? <Option option={typeOption} /> : <div className="tip-default">{gettext('No types')}</div>}
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

const SubmitTicket = ({ projectUuid, onPageChange, typesData }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const ticketRef = useRef(null);

  const { insertRow } = useData();

  const longtextAPI = useMemo(() => new LongTextEditorUtilities({ server, api: {
    uploadFile: (...params) => portalAPI.uploadFile(projectUuid, ...params)
  } }), [projectUuid]);

  useEffect(() => {
    setIsLoading(false);
  }, []);

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
      toaster.success(gettext('Ticket has been submitted'));
      setTitle('');
      setContent('');
      setType('');
      insertRow(TICKET_TABLE_NAME);
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

  const renderSubmitBtns = useCallback(() => {
    return (
      <div>
        <Button onClick={onSubmit} color="primary" disabled={disabled}>
          {isSubmitting ? gettext('Submitting...') : gettext('Submit')}
        </Button>
      </div>
    );
  }, [disabled, isSubmitting, onSubmit]);

  if (isLoading) {
    return <CenteredLoading />;
  }

  const isSmallScreen = containerWidth < 800; // 800 is the width of the ticket form

  return (
    <div className="sea-qa-portal-new-ticket-container" ref={ticketRef}>
      <div className={classnames('sea-qa-portal-new-ticket', { 'small': isSmallScreen })}>
        <div className="sea-qa-portal-ticket-settings">
          <div className="sea-qa-portal-ticket-name d-flex align-items-center">{gettext('New ticket')}</div>
          <div className="sea-qa-portal-ticket-settings-container d-flex">
            <div className="sea-qa-portal-ticket-content-settings">
              <div className="sea-qa-portal-ticket-label">
                <Label>
                  {gettext('Title')}
                  <span className="required-tip" title={gettext('Required')}>{'*'}</span>
                </Label>
                <Input autoFocus disabled={isSubmitting} value={title} onChange={onTitleChange} />
              </div>
              <div className="sea-qa-portal-ticket-content">
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
              <div className="sea-qa-portal-ticket-footer">
                {renderSubmitBtns()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubmitTicket;
