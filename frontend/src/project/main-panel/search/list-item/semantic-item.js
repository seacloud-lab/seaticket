import React, { useCallback, useMemo } from 'react';
import { getPreviewContent } from '@seafile/seafile-editor';

const SemanticItem = ({ id, content = '', url = '', score = '', searchValue, settings }) => {
  const isShowScore = useMemo(() => settings?.developer_mode, [settings]);

  const openOriginalURL = useCallback(() => {
    if (!url) return;
    window.open(url);
  }, [url]);

  const renderDetail = () => {
    const isMarkdown = true;
    const previewTextNeedSlice = false;
    const { previewText } = getPreviewContent(content, isMarkdown, previewTextNeedSlice);
    return previewText.replace(new RegExp(searchValue, 'ig'), (match) => `<span class="font-weight-bold">${match}</span>`);
  };

  const title = useMemo(() => {
    if (url) return url.replace(/^https?:\/\/(www\.)?/, '');
    const firstNonEmptyLine = content.split('\n').map(s => s.trim()).find(s => s.length > 0) || '';
    return firstNonEmptyLine;
  }, [url, content]);

  return (
    <div className="list-item" key={id} onClick={openOriginalURL}>
      <div className="list-item-content">
        <div className="list-item-title">
          <span className="text-truncate list-item-title-content">{title || ''}</span>
          {isShowScore && score && (
            <span className="list-item-score ml-2">{score}</span>
          )}
        </div>
        {content &&
          <div className="list-item-detail" dangerouslySetInnerHTML={{ __html: renderDetail() }}></div>
        }
      </div>
    </div>
  );
};

export default SemanticItem;
