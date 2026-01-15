import React, { useCallback, useMemo, useState, useRef } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import dayjs from 'dayjs';
import { getPreviewContent } from '@seafile/seafile-editor';
import { CONNECTION_TYPES, CONNECTION_TYPE } from '../../connections/constants';
import { formatWithTimezone, getNumberDisplayString } from '@/sea-metadata/utils/column';
import CustomModalHeader from '@/components/modal-header/index';
import IconButton from '@/components/icon-button/index';
import { getResourceIconURL } from '@/project/utils';

import './index.css';

const ListItem = ({ type, id, title, subtitle, url, content = '', bumped_at = '', score = '', searchValue, settings }) => {
  const connectionOption = CONNECTION_TYPES.find(c => c.type === type);
  const isShowScore = useMemo(() => settings?.developer_mode, [settings]);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const detailContentRef = useRef(null);

  if (detailContentRef.current === null) {
    // DISCOURSE_FORUM content format is HTML, other types formats are Markdown
    if (type === CONNECTION_TYPE.DISCOURSE_FORUM) {
      detailContentRef.current = content;
    } else {
      try {
        const isMarkdown = true;
        const previewTextNeedSlice = false;
        const result = getPreviewContent(content, isMarkdown, previewTextNeedSlice);
        if (!result || !result.previewText) {
          detailContentRef.current = content;
        } else {
          const { previewText } = result;
          if (!searchValue) {
            detailContentRef.current = previewText;
          } else {
            detailContentRef.current = previewText.replace(new RegExp(searchValue, 'ig'), (match) => `<span class="font-weight-bold">${match}</span>`);
          }
        }
      } catch (error) {
        detailContentRef.current = content || '';
      }
    }
  }

  const openOriginalURL = useCallback(() => {
    if (!url) return;
    window.open(url);
  }, [url]);

  const handleItemClick = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false);
  }, []);

  const handleContentClick = useCallback((e) => {
    e.stopPropagation();
    openOriginalURL();
  }, [openOriginalURL]);

  const iconSrc = getResourceIconURL(type);
  let altText = '';

  if (type === 'knowledge_base') {
    altText = 'Knowledge Base';
  } else if (type === 'ticket') {
    altText = 'Ticket';
  } else {
    altText = connectionOption ? connectionOption.name : (type || '');
  }

  return (
    <>
      <div className="list-item" key={id} onClick={handleItemClick}>
        <div className="list-item-icon">
          <img src={iconSrc} alt={altText} className="sea-qa-project-connection-type-icon" />
        </div>
        <div className="list-item-content">
          <div className="list-item-title">
            <span className="text-truncate list-item-title-content" title={title || ''}>{title || ''}</span>
            {isShowScore && score && (
              <span className="list-item-score ml-2">
                {getNumberDisplayString(score, { format: 'number', enable_precision: true, precision: 2 })}
              </span>
            )}
          </div>
          <div className="list-item-path">{subtitle || ''}</div>
          {bumped_at &&
            <div className="list-item-time" title={formatWithTimezone(bumped_at)}>
              {dayjs(bumped_at).format('YYYY-MM-DD HH:mm:ss')}
            </div>
          }
          {content &&
            <div className="list-item-detail" dangerouslySetInnerHTML={{ __html: detailContentRef.current }}></div>
          }
        </div>
      </div>
      <Modal isOpen={isDialogOpen} toggle={handleDialogClose} size="lg" className="list-item-detail-dialog">
        <CustomModalHeader toggle={handleDialogClose}>
          <span className="text-truncate list-item-title-content" title={title || ''}>{title || ''}</span>
          <IconButton icon="open-in-new-tab" onClick={handleContentClick} title={window.gettext('Open original URL')} />
        </CustomModalHeader>
        <ModalBody>
          <div dangerouslySetInnerHTML={{ __html: detailContentRef.current }} />
        </ModalBody>
      </Modal>
    </>
  );
};

export default ListItem;
