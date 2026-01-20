import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Label } from 'reactstrap';
import classnames from 'classnames';
import { gettext, SELECT_OPTION_COLORS } from '@/constants';
import Option from '../../option';
import { OptionEditor } from '@/components';
import { isCellValueChanged } from '@/sea-metadata/utils/cell';
import { getRowsByIds } from '@/sea-metadata/utils/row';
import { isInputOrEditorActive, isActiveOtherPopover } from '@/utils/dom';
import { isEsc, isT } from '@/utils/hotkey';
import TagOption from '@/components/tag-option';

import './index.css';

const TagsSettings = ({
  id,
  isReadonly,
  value = [],
  className = 'mb-4',
  isLoading = false,
  tagsData,
  createTag,
  onChange,
}) => {
  const [isShowEditor, setIsShowEditor] = useState(false);

  const editorRef = useRef(null);

  const tagOptions = useMemo(() => {
    if (isLoading) return [];
    return tagsData && tagsData.rows ? tagsData.rows.map(tag => {
      return {
        ...tag,
        value: tag._id,
        label: <TagOption tag={tag} />,
      };
    }) : [];
  }, [tagsData, isLoading]);

  const openEditor = useCallback((event) => {
    if (isReadonly) return;
    event.preventDefault();
    event.stopPropagation();
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

  const onHotKey = useCallback((event) => {
    if (isInputOrEditorActive() || isActiveOtherPopover('tags-editor-popover')) return;

    if (isT(event)) {
      openEditor(event);
    } else if (isEsc(event)) {
      closeEditor();
    }
  }, [openEditor, closeEditor]);

  useEffect(() => {
    document.addEventListener('keydown', onHotKey, true);
    return () => {
      document.removeEventListener('keydown', onHotKey, true);
    };
  }, [onHotKey]);

  const selectedTags = getRowsByIds(tagsData, value).filter(tag => tag);

  return (
    <div className={classnames('sea-qa-project-ticket-settings-item', className)}>
      <Label>{gettext('Tags')}</Label>
      <div className="tags-formatter" onClick={openEditor} ref={editorRef}>
        {selectedTags.length > 0 ? (
          <>
            {selectedTags.map(tag => (<Option key={tag._id} option={tag} />))}
          </>
        ) : (
          <div className="tip-default">{gettext('No tags')}</div>
        )}
      </div>
      {isShowEditor && (
        <OptionEditor
          id={id}
          target={editorRef}
          isLoading={isLoading}
          isMultiple={true}
          className="sea-qa-tags-selector-popover"
          placeholder={gettext('Search tags')}
          emptyTip={gettext('No tags')}
          value={value}
          options={tagOptions}
          optionHeight={36}
          onToggle={closeEditor}
          onChange={handleChange}
          onCreate={handleCreateTag}
        />
      )}
    </div>
  );
};

export default TagsSettings;
