import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import classnames from 'classnames';
import { gettext, SELECT_OPTION_COLORS } from '@/constants';
import Tag from '@/sea-metadata/components/tag';
import RemoveBtn from '@/sea-metadata/components/tag/remove-btn';
import { CustomizePopover, CustomizeLabel } from '@/components';
import OptionEditorContainer from '@/components/option-editor/option-editor-container';
import { isCellValueChanged } from '@/sea-metadata/utils/cell';
import { getRowById, getRowsByIds } from '@/sea-metadata/utils/row';
import { isInputOrEditorActive, isActiveOtherPopover } from '@/utils/dom';
import { isEsc, isT } from '@/utils/hotkey';
import TagOption from '@/components/tag-option';

import './index.css';

const TagsSettings = ({
  isReadonly,
  value: defaultValue,
  className = 'mb-4',
  isLoading = false,
  tagsData,
  createTag,
  onChange,
}) => {
  const [isShowEditor, setIsShowEditor] = useState(false);

  const value = useMemo(() => Array.isArray(defaultValue) ? defaultValue.map(v => String(v)) : [], [defaultValue]);

  const editorRef = useRef(null);
  const optionEditorContainerRef = useRef(null);

  const options = useMemo(() => {
    if (isLoading) return [];
    if (!tagsData?.rows) return [];
    return tagsData.rows.map(tag => {
      return {
        ...tag,
        value: tag._id,
        label: <TagOption tag={tag} />,
      };
    });
  }, [tagsData, isLoading]);

  const openEditor = useCallback((event) => {
    if (isReadonly) return;
    event.preventDefault();
    event.stopPropagation();
    setIsShowEditor(true);
  }, [isReadonly]);

  const closeEditor = useCallback(() => {
    let newValue = optionEditorContainerRef.current.getValue();
    if (isCellValueChanged(value, newValue)) {
      if (newValue.length > 0) {
        const tags = getRowsByIds(tagsData, newValue);
        newValue = tags.map(tag => Number(tag._id));
      }
      onChange(newValue);
    }
    setIsShowEditor(false);
  }, [value, onChange]);

  const handleCreateTag = useCallback((name) => {
    const random = Math.floor(Math.random() * (SELECT_OPTION_COLORS.length - 1));
    const option = SELECT_OPTION_COLORS[random];
    const { COLOR, TEXT_COLOR } = option;
    return createTag({ name, description: '', color: COLOR, text_color: TEXT_COLOR }).then(tag => {
      const { _id } = tag;
      return {
        ...tag,
        value: _id,
        label: (<TagOption tag={tag} />),
      };
    });
  }, [createTag]);

  const handleRemove = useCallback((event, tag) => {
    if (isShowEditor) return;
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    let newValue = value.filter(i => i !== Number(tag._id));
    if (newValue.length > 0) {
      const tags = getRowsByIds(tagsData, newValue);
      newValue = tags.map(tag => Number(tag._id));
    }
    onChange(newValue);
  }, [isShowEditor, value, tagsData, onChange]);

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
      <CustomizeLabel icon="tag-filled">
        {gettext('Tags')}
      </CustomizeLabel>
      <div
        className={classnames('tags-formatter', { 'valid': selectedTags.length > 0 })}
        onClick={openEditor}
        ref={editorRef}
      >
        {selectedTags.length > 0 ? (
          <>
            {selectedTags.map(tag => (
              <Tag tag={tag} key={tag._id} className="mr-0">
                <RemoveBtn callback={(event) => handleRemove(event, tag)} />
              </Tag>
            ))}
          </>
        ) : (
          <div className="tip-default">{gettext('No tags')}</div>
        )}
      </div>
      {isShowEditor && (
        <CustomizePopover
          target={editorRef}
          className="option-editor-popover sea-qa-tags-selector-popover sea-ticket-settings-popover popover-radius-4 hide-description"
          sameWidthWithTarget={240}
          hidePopover={closeEditor}
          hidePopoverWithEsc={closeEditor}
        >
          <OptionEditorContainer
            ref={optionEditorContainerRef}
            isMultiple={true}
            optionHeight="fit-content"
            placeholder={gettext('Search tags')}
            emptyTip={gettext('No available tags')}
            value={value}
            options={options}
            onCreate={handleCreateTag}
          >
            {({ value: selectedTagIds, onChange }) => {
              if (!Array.isArray(selectedTagIds) || selectedTagIds.length === 0) return null;
              return selectedTagIds.map(tagId => {
                const tag = getRowById(tagsData, tagId);
                if (!tag) return null;
                return (
                  <Tag tag={tag} key={tagId} className="m-0">
                    <RemoveBtn callback={() => onChange(tagId)} />
                  </Tag>
                );
              });
            }}
          </OptionEditorContainer>
        </CustomizePopover>
      )}
    </div>
  );
};

export default TagsSettings;
