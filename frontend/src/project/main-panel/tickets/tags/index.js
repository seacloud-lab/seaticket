import React, { useCallback, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import { useTags } from '../../../hooks';
import { CenteredLoading, EmptyTip, SearchInput } from '../../../../components';
import { gettext } from '../../../../constants';
import TagRecord from './tag-record';
import TagDialog from './tag-dialog';

import './index.css';

const Tags = () => {
  const [isShowTagDialog, setIsShowTagDialog] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const { isLoading, tags, createTag, modifyTag, deleteTag } = useTags();

  const editTag = useRef(null);

  const openTagDialog = useCallback((tag = null) => {
    editTag.current = tag;
    setIsShowTagDialog(true);
  }, []);

  const closeTagDialog = useCallback(() => {
    editTag.current = null;
    setIsShowTagDialog(false);
  }, []);

  const onSearchValueChange = useCallback((value) => {
    setSearchValue(value);
  }, []);

  if (isLoading) return (<CenteredLoading />);

  const lowerSearchValue = searchValue.toLowerCase();
  const displayTags = searchValue ? tags.filter(tag => tag.name.toLowerCase().includes(lowerSearchValue)) : tags;

  return (
    <>
      <div className="sea-qa-project-tags-wrapper d-flex-column">
        <div className="sea-qa-project-tags-wrapper-header">
          <SearchInput placeholder={gettext('Search tags')} value={searchValue} onChange={onSearchValueChange} />
          <Button color="primary" className="ml-4" onClick={() => openTagDialog()}>{gettext('New tag')}</Button>
        </div>
        <div className="sea-qa-project-tags-wrapper-body">
          <div className="sea-qa-project-tags-op-wrapper p-2 ">
            <div className="sea-qa-project-tags-op-wrapper-left">
              <div className="sea-qa-project-tags-op-btn disabled">{displayTags.length && gettext('{count} tags').replace('{count}', displayTags.length)}</div>
            </div>
            <div className="sea-qa-project-tags-op-wrapper-right">
              <div className="sea-qa-project-tags-op-btn">{gettext('Sort')}</div>
            </div>
          </div>
          <div className="sea-qa-project-tags-body">
            {displayTags.length === 0 ? (
              <EmptyTip text={gettext('No tags')} />
            ) : (
              <div className="sea-qa-project-tags">
                {displayTags.map(tag => (<TagRecord key={tag.id} tag={tag} editTag={openTagDialog} deleteTag={deleteTag} />))}
              </div>
            )}
          </div>
        </div>
      </div>
      {isShowTagDialog && (
        <TagDialog
          tag={editTag.current}
          onToggle={closeTagDialog}
          onSubmit={editTag.current ? (newTag) => modifyTag(editTag.current.id, newTag) : createTag}
        />
      )}
    </>
  );

};

export default Tags;
