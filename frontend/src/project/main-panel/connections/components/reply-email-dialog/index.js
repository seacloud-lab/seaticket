import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ModalBody, ModalFooter, Button, FormGroup, Label, Input } from 'reactstrap';
import { gettext } from '@/constants';
import { ModalHeader, toaster } from '@/components';
import { connectionsAPI } from '@/project/api';
import { Utils } from '@/utils/utils';

import './index.css';

const escapeHtml = (value = '') => value
  .replace(/&/g, '&​amp;')
  .replace(/"/g, '&​quot;')
  .replace(/'/g, '&​#39;');

const buildUserHtmlContent = (text) => {
  if (!text) return '';
  return `<div style="font-size:14px;color:#111827;line-height:1.7;">${escapeHtml(text).replace(/\n/g, '<br />')}</div>`;
};

const buildQuoteTextBlock = (email) => {
  if (!email) return '';
  const sender = email.email_from || '';
  const time = email.modified_time || '';
  const baseContent = normalizeQuoteContent(email);
  if (!baseContent) return '';
  const lines = baseContent
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0)
    .map(line => `> ${line.trim()}`);
  return `${gettext('At')} ${time}, ${sender} ${gettext('wrote')}:\n${lines.join('\n')}`;
};

const genReplySubject = (subject) => {
  const value = (subject || '').trim();
  if (!value) return 'Re:';
  if (value.toLowerCase().startsWith('re:')) return value;
  return `Re: ${value}`;
};

const getReplyTargetEmail = (details) => {
  const emails = details?.details;
  if (!Array.isArray(emails) || emails.length === 0) return null;

  for (let i = emails.length - 1; i >= 0; i--) {
    if (!emails[i]?.is_sender) {
      return emails[i];
    }
  }

  return emails[emails.length - 1];
};

const getReplyOptionLabel = (email) => {
  const sender = (email?.email_from || '').trim();
  const time = (email?.modified_time || '').trim();
  const content = (email?.content || '').replace(/\s+/g, ' ').trim();
  const contentPreview = content.length > 30 ? `${content.slice(0, 30)}...` : content;
  return `${sender}${time ? ` | ${time}` : ''}${contentPreview ? ` | ${contentPreview}` : ''}`;
};

const normalizeQuoteContent = (email) => {
  const content = (email?.content || '').trim();
  if (content) return content;
  const html = (email?.html_content || '').trim();
  if (!html) return '';
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
};
const buildQuoteBlock = (email) => {
  if (!email) return '';
  const sender = email.email_from || '';
  const time = email.modified_time || '';
  const baseContent = normalizeQuoteContent(email) || gettext('No content');
  const quoteLines = baseContent
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0)
    .map(line => escapeHtml(line.trim()))
    .join('<br>');

  return `<br><p>${gettext('At')} ${time}, "${escapeHtml(sender)}" ${gettext('wrote')}:</p><blockquote id="isReplyContent" style="PADDING-LEFT: 1ex; MARGIN: 0px 0px 0px 0.8ex; BORDER-LEFT: #ccc 1px solid"><div style="font-family: -apple-system, system-ui; font-size: 14px; color: rgb(0, 0, 0); line-height: 1.43;">${quoteLines}</div></blockquote>`;
};

const ReplyEmailDialog = ({ projectUuid, connection, recordId, details, onClose, onSuccess }) => {
  const [isSubmitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const replyTargetEmail = useMemo(() => getReplyTargetEmail(details), [details]);
  const replyEmailOptions = useMemo(() => {
    const emails = details?.details;
    if (!Array.isArray(emails) || emails.length === 0) return [];
    return emails.filter(item => item?.message_id && !item?.is_sender);
  }, [details]);

  const [replyToMessageId, setReplyToMessageId] = useState('');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [includeQuote, setIncludeQuote] = useState(true);

  const currentReplyTargetEmail = useMemo(() => {
    if (!replyToMessageId) return replyTargetEmail;
    return replyEmailOptions.find(item => item.message_id === replyToMessageId) || replyTargetEmail;
  }, [replyToMessageId, replyEmailOptions, replyTargetEmail]);

  useEffect(() => {
    setReplyToMessageId(replyTargetEmail?.message_id || '');
  }, [replyTargetEmail]);

  useEffect(() => {
    setTo(currentReplyTargetEmail?.email_from || '');
    setCc(currentReplyTargetEmail?.cc || '');
    setSubject(genReplySubject(currentReplyTargetEmail?.title || details?.title));
  }, [currentReplyTargetEmail, details]);

  const handleSubmit = () => {
    const trimmedContent = (content || '').trim();
    if (!trimmedContent) {
      setErrorMessage(gettext('Content is required.'));
      return;
    }
    let composedContent = trimmedContent;
    let composedHtml = buildUserHtmlContent(trimmedContent);

    if (includeQuote) {
      const quoteHtmlBlock = buildQuoteBlock(currentReplyTargetEmail);
      const quoteTextBlock = buildQuoteTextBlock(currentReplyTargetEmail);
      if (quoteHtmlBlock) {
        composedHtml = `${composedHtml}${quoteHtmlBlock}`;
      }
      if (quoteTextBlock) {
        composedContent = `${composedContent}\n\n${quoteTextBlock}`;
      }
    }

    const payload = {
      content: composedContent,
      html_content: composedHtml,
    };
    if ((to || '').trim()) {
      payload.to = to.trim();
    }
    if ((cc || '').trim()) {
      payload.cc = cc.trim();
    }
    if ((subject || '').trim()) {
      payload.subject = subject.trim();
    }
    if ((replyToMessageId || '').trim()) {
      payload.reply_to_message_id = replyToMessageId.trim();
    }

    setSubmitting(true);
    setErrorMessage('');
    const successPayload = {
      ...payload,
      replyTargetEmail: currentReplyTargetEmail,
    };
    connectionsAPI.replyConnectionEmail(projectUuid, connection.id, recordId, payload).then(() => {
      toaster.success(gettext('Email sent.'));
      if (onSuccess) {
        onSuccess(successPayload);
      }
      onClose();
    }).catch((error) => {
      setErrorMessage(Utils.getErrorMsg(error));
    }).finally(() => {
      setSubmitting(false);
    });
  };

  return (
    <Modal className="sea-qa-reply-email-dialog" isOpen={true} toggle={onClose}>
      <ModalHeader toggle={onClose}>{gettext('Reply email')}</ModalHeader>
      <ModalBody>
        {errorMessage && (
          <div className="alert alert-danger" role="alert">{errorMessage}</div>
        )}
        {replyEmailOptions.length > 0 && (
          <FormGroup>
            <Label>{gettext('Reply to')}</Label>
            <Input
              type="select"
              value={replyToMessageId}
              onChange={(event) => setReplyToMessageId(event.target.value)}
            >
              {replyEmailOptions.map((email) => (
                <option key={email.message_id} value={email.message_id}>{getReplyOptionLabel(email)}</option>
              ))}
            </Input>
          </FormGroup>
        )}
        <FormGroup check className="mb-3">
          <Label check>
            <Input
              type="checkbox"
              checked={includeQuote}
              onChange={(event) => setIncludeQuote(event.target.checked)}
            />
            {gettext('Include quoted message')}
          </Label>
        </FormGroup>
        <FormGroup>
          <Label>{gettext('To')}</Label>
          <Input
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder={gettext('Recipient email addresses')}
          />
        </FormGroup>
        <FormGroup>
          <Label>{gettext('Cc')}</Label>
          <Input
            value={cc}
            onChange={(event) => setCc(event.target.value)}
            placeholder={gettext('Cc email addresses (optional)')}
          />
        </FormGroup>
        <FormGroup>
          <Label>{gettext('Subject')}</Label>
          <Input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder={gettext('Email subject')}
          />
        </FormGroup>
        <FormGroup className="mb-0">
          <Label>{gettext('Content')}</Label>
          <Input
            type="textarea"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="reply-email-content-input"
            placeholder={gettext('Write your reply...')}
          />
        </FormGroup>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" disabled={isSubmitting} onClick={onClose}>{gettext('Cancel')}</Button>
        <Button color="primary" disabled={isSubmitting} onClick={handleSubmit}>{isSubmitting ? gettext('Sending...') : gettext('Send')}</Button>
      </ModalFooter>
    </Modal>
  );
};

export default ReplyEmailDialog;
