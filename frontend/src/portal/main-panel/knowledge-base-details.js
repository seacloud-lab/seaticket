import React, { useEffect, useState } from 'react';
import { Icon, CustomizeMarkdownViewer, CenteredLoading } from '@/components';
import { gettext } from '@/constants';
import { knowledgeBaseAPI } from '@/project/api';
import { Input, Label } from 'reactstrap';
import '../../project/main-panel/knowledge-base/view/edit-knowledge/index.css';

const KnowledgeBaseDetails = ({ row, onToggle }) => {
  const [details, setDetails] = useState({
    title: '',
    content: '',
    tags: [],
    created_time: '',
    modified_time: '',
    creator: '',
    last_modifier: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!row) {
      setDetails({ title: '', content: '', tags: [], created_time: '', modified_time: '', creator: '', last_modifier: '' });
      setIsLoading(false);
      return;
    }
    const normalizeTags = (arr) => Array.isArray(arr) ? arr.map(t => (typeof t === 'object' ? (t.name || '') : t)).filter(Boolean) : [];
    const parseContent = (c) => {
      if (!c) return '';
      if (typeof c === 'string') return c;
      if (typeof c === 'object') return c.text || c.preview || '';
      return '';
    };
    const baseTags = normalizeTags(row.tags);
    const baseContent = parseContent(row.content);
    setDetails({
      title: row.title || '',
      content: baseContent || '',
      tags: baseTags,
      created_time: row.created_time || '',
      modified_time: row.modified_time || '',
      creator: row.creator || '',
      last_modifier: row.last_modifier || '',
    });
    if (!baseContent && row._id) {
      const { projectUuid } = (window.app && window.app.pageOptions) || {};
      if (!projectUuid) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      knowledgeBaseAPI.getRecord(projectUuid, row._id)
        .then(res => {
          const rec = res?.data?.record || {};
          const contentText = typeof rec.content === 'string' ? rec.content : (rec.content && rec.content.text) || '';
          const tags = Array.isArray(rec.tags) ? rec.tags.map(t => t.name || t) : baseTags;
          setDetails({
            title: rec.title || row.title || '',
            content: contentText || '',
            tags,
            created_time: rec.created_time || row.created_time || '',
            modified_time: rec.modified_time || row.modified_time || '',
            creator: rec.creator || row.creator || '',
            last_modifier: rec.last_modifier || row.last_modifier || '',
          });
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [row]);

  const { title, content, tags } = details;

  if (!row) return null;

  return (
    <div className="kb-details-overlay" style={{ position: 'fixed', inset: 0, zIndex: 999998, backgroundColor: '#fff', overflow: 'hidden' }}>
      <div className="sea-qa-project-edit-knowledge" style={{ maxWidth: 1000, margin: '24px auto', overflowY: 'auto', overflowX: 'hidden' }}>
        <div className="sea-qa-project-knowledge-settings">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div className="sea-qa-project-knowledge-name">{gettext('Record')}</div>
            <button className="btn btn-link" onClick={onToggle} title={gettext('Close')}>
              <Icon symbol="close" />
            </button>
          </div>
          <div className="sea-qa-project-knowledge-settings-container">
            <div className="sea-qa-project-knowledge-content-settings" style={{ width: '100%' }}>
              <div className="sea-qa-project-knowledge-title mb-4">
                <Label>{gettext('Title')}</Label>
                <Input value={title} readOnly disabled />
              </div>
              <div className="mb-4">
                <Label>{gettext('Tags')}</Label>
                {Array.isArray(tags) && tags.length > 0 ? (
                  <div>{tags.map((t, idx) => <span key={idx} className="badge badge-light mr-1">{t}</span>)}</div>
                ) : (
                  <div style={{ color: '#999' }}>{gettext('No tags')}</div>
                )}
              </div>
              <div className="sea-qa-project-knowledge-content mb-4">
                <Label>{gettext('Content')}</Label>
                <div style={{ border: '1px solid #e5e5e5', borderRadius: 4, backgroundColor: '#fafafa', minHeight: 220, padding: 8 }}>
                  {isLoading ? (
                    <CenteredLoading />
                  ) : (
                    <CustomizeMarkdownViewer value={content || ''} showTOC={false} onLinkClick={(link) => window.open(link, '_blank', 'noopener,noreferrer')} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseDetails;
