import React, { useCallback, useMemo } from 'react';
import classnames from 'classnames';
import { IconButton } from '@/components';
import SimpleLongTextFormatter from '../../../connections/components/cell-formatter/long-text-formatter';
import { useDocuments } from '../../hooks';

import './index.css';

const CustomizeLink = ({ canPreviewLinkedFile = true, mdFiles = [], element, isShowPopover, onLinkClick, onHrefClick, attributes, children, editor }) => {
  const { openDocument } = useDocuments();

  const file = useMemo(() => {
    if (!Array.isArray(mdFiles) || mdFiles.length === 0) return null;
    return mdFiles.find(file => file.url === element.url);
  }, [element]);

  const onClick = useCallback((event) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    openDocument(file);
  }, [file, openDocument]);

  const { url } = element;
  if (!url.startsWith('file:///sea-ticket/')) {
    return (
      <span
        onClick={onLinkClick}
        data-url={url}
        className={classnames('sf-virtual-link', { selected: isShowPopover })}
        {...attributes}
      >
        <a href={url} onClick={onHrefClick}>{children}</a>
      </span>
    );
  }

  if (!file) {
    return (
      <span
        onClick={onLinkClick}
        data-url={url}
        className={classnames('sf-virtual-link', { selected: isShowPopover })}
        {...attributes}
      >
        <a href={url} onClick={onHrefClick}>{children}</a>
      </span>
    );
  }

  return (
    <div className="sea-ai-chat-customize-link p-4" onClick={canPreviewLinkedFile ? onClick : () => {}}>
      <div className="sea-ai-chat-customize-link-header">
        <div className="sea-ai-chat-customize-link-name">{file.name}</div>
        {canPreviewLinkedFile && (<IconButton className="sea-ai-chat-customize-md-expand-btn d-flex" icon="expand" />)}
      </div>
      <SimpleLongTextFormatter
        value={file.content}
        canPreview={false}
        textCount={500}
        className="sea-ai-chat-customize-md-link-body"
      />
    </div>
  );
};

export default CustomizeLink;
