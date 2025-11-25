import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Label } from 'reactstrap';
import classnames from 'classnames';
import { gettext, SELECT_OPTION_COLORS } from '@/constants';
import Option from '../../option';
import { useMetadata } from '../../../hooks';
import { OptionEditor } from '@/components';
import { isCellValueChanged } from '@/sea-metadata/utils/cell';

import './index.css';

const TagsSettings = ({
  isReadonly,
  value = [],
  className = 'mb-4',
  onChange,
}) => {
  const [isShowEditor, setIsShowEditor] = useState(false);

  const { isLoading, tagsData, createTag } = useMetadata();

  const editorRef = useRef(null);

  const tagOptions = useMemo(() => {
    if (isLoading) return [];
    return tagsData && tagsData.rows ? tagsData.rows.map(tag => {
      const { _id, color, name, description } = tag;
      return {
        ...tag,
        value: _id,
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
    }) : [];
  }, [tagsData, isLoading]);

  const openEditor = useCallback(() => {
    if (isReadonly) return;
    setIsShowEditor(true);
  }, [isReadonly]);

  const closeEditor = useCallback(() => {
    setIsShowEditor(false);
  }, []);

  const handleCreateTag = useCallback((name) => {
    const random = Math.floor(Math.random() * (SELECT_OPTION_COLORS.length - 1));
    const option = SELECT_OPTION_COLORS[random];
    const { COLOR, TEXT_COLOR } = option;
    return createTag({ name, description: '', color: COLOR, text_color: TEXT_COLOR }).then(tag => {
      const { _id, color, name, description } = tag;
      return {
        ...tag,
        value: _id,
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

  const handleChange = useCallback((newValue) => {
    if (!isCellValueChanged(newValue, value)) return;
    onChange(newValue);
  }, [onChange, value]);

  const selectedTags = value.map(v => tagsData.id_row_map[v]).filter(tag => tag);

  return (
    <div className={classnames('sea-qa-project-ticket-settings-item', className)}>
      <Label>{gettext('Tags')}</Label>
      <div className="tags-formatter" onClick={openEditor} ref={editorRef}>
        {selectedTags.length > 0 ? (
          <>
            {selectedTags.map(tag => (<Option key={tag._id} tag={tag} />))}
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
          value={value}
          options={tagOptions}
          onToggle={closeEditor}
          onChange={handleChange}
          onCreate={handleCreateTag}
        />
      )}
    </div>
  );
};

export default TagsSettings;
