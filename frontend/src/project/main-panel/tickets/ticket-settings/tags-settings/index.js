import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Label } from 'reactstrap';
import classnames from 'classnames';
import { gettext, SELECT_OPTION_COLORS } from '../../../../../constants';
import Tag from '../../tags/tag';
import { useTags } from '../../../../hooks';
import { OptionEditor } from '../../../../../components';

import './index.css';

const TagsSettings = ({
  isReadonly,
  value = [],
  className = 'mb-4',
  onChange,

}) => {
  const [isShowEditor, setIsShowEditor] = useState(false);

  const { isLoading, tags, createTag } = useTags();

  const editorRef = useRef(null);

  const tagOptions = useMemo(() => {
    if (isLoading) return [];
    return tags.map(tag => {
      const { id, color, name, description } = tag;
      return {
        ...tag,
        value: id,
        label: (
          <>
            <div className="sea-qa-tags-selector-tag-bg" style={{ backgroundColor: color }}></div>
            <div className="sea-qa-tags-selector-tag-name-description">
              <div className="sea-qa-tags-selector-tag-name">{name}</div>
              {description && (<div className="sea-qa-tags-selector-tag-description">{description}</div>)}
            </div>
          </>
        ),
      };
    });
  }, [tags, isLoading]);

  const openEditor = useCallback(() => {
    if (isReadonly) return;
    setIsShowEditor(true);
  }, [isReadonly]);

  const closeEditor = useCallback(() => {
    setIsShowEditor(false);
  }, []);

  const onValueChange = useCallback((value = []) => {
    const selectedTags = value.map(tagId => tags.find(tag => tag.id === tagId)).filter(item => item);
    onChange(selectedTags);
  }, [onChange, tags]);

  const handleCreateTag = useCallback((name) => {
    const random = Math.floor(Math.random() * (SELECT_OPTION_COLORS.length - 1));
    const option = SELECT_OPTION_COLORS[random];
    const { COLOR, TEXT_COLOR } = option;
    return createTag({ name, description: '', color: COLOR, text_color: TEXT_COLOR }).then(tag => {
      const { id, color, name, description } = tag;
      return {
        ...tag,
        value: id,
        label: (
          <>
            <div className="sea-qa-tags-selector-tag-bg" style={{ backgroundColor: color }}></div>
            <div className="sea-qa-tags-selector-tag-name-description">
              <div className="sea-qa-tags-selector-tag-name">{name}</div>
              {description && (<div className="sea-qa-tags-selector-tag-description">{description}</div>)}
            </div>
          </>
        ),
      };
    });
  }, [createTag]);

  const selectedTagIds = value.map(tag => tag.id);

  return (
    <div className={classnames('sea-qa-project-ticket-settings-item', className)}>
      <Label>{gettext('tags')}</Label>
      <div className="tags-formatter" onClick={openEditor} ref={editorRef}>
        {value.length > 0 ? (
          <>
            {value.map(tag => (<Tag tag={tag} />))}
          </>
        ) : (
          <div className="tip-default">{gettext('No tags')}</div>
        )}
      </div>
      {isShowEditor && (
        <OptionEditor
          target={editorRef}
          isLoading={isLoading}
          isMultiple={true}
          className="sea-qa-tags-selector-popover"
          placeholder={gettext('Search tags')}
          emptyTip={gettext('No tags')}
          value={selectedTagIds}
          options={tagOptions}
          onToggle={closeEditor}
          onChange={onValueChange}
          onCreate={handleCreateTag}
        />
      )}
    </div>
  );
};

export default TagsSettings;
