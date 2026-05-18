import React from 'react';
import classnames from 'classnames';
import { AsyncCollaborator, CustomizeMarkdownViewer, IconButton } from '@/components';
import { useTags } from '@/project/hooks';
import { useCollaborators } from '@/sea-metadata';
import { mediaUrl } from '@/constants';
import DateFormatter from '@/project/main-panel/connections/components/cell-formatter/date-formatter';
import { getRowsByIds } from '@/sea-metadata/utils/row';
import Tag from '@/sea-metadata/components/tag';

import './index.css';

const Preview = ({ knowledge, className, onLinkClick }) => {
  const { title, content, tags, creator, created_time } = knowledge;

  const { tagsData } = useTags();
  const { collaborators, collaboratorsCache, updateCollaboratorsCache, queryUser } = useCollaborators();

  const validTagIds = Array.isArray(tags) ? tags.map(t => t + '') : [];
  const validTags = getRowsByIds(tagsData, validTagIds).filter(tag => tag);

  return (
    <div className={classnames('seaqa-knowledge-preview', className)}>
      <div className="seaqa-knowledge-create-info">
        <AsyncCollaborator
          className="seaqa-knowledge-creator"
          value={creator}
          mediaUrl={mediaUrl}
          collaborators={collaborators}
          collaboratorsCache={collaboratorsCache}
          updateCollaboratorsCache={updateCollaboratorsCache}
          api={queryUser}
        />
        <div className="seaqa-knowledge-create-time">
          <IconButton icon="time-stroked" className="no-hover-bg" size={14} />
          <DateFormatter value={created_time} className="seaqa-knowledge-create-time-content" />
        </div>
      </div>
      <div className={classnames('seaqa-knowledge-title', { 'mb-6': validTags.length === 0 })}>
        {title}
      </div>
      {validTags.length > 0 && (
        <div className="seaqa-knowledge-tags">
          {validTags.map(tag => (<Tag tag={tag} key={tag._id} />))}
        </div>
      )}
      <CustomizeMarkdownViewer
        className="seaqa-knowledge-content"
        value={content}
        showTOC={false}
        onLinkClick={onLinkClick}
      />
    </div>
  );

};

export default Preview;
