import React, { forwardRef, useMemo, useImperativeHandle, useCallback, useRef, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import context from '@/sea-metadata/context';
import OptionEditorContainer from '@/components/option-editor/option-editor-container';
import { gettext } from '@/constants';
import { SELECT_OPTION_COLORS } from '../../../constants';
import { useTagsData } from '../../../hooks';
import TagOption from '@/components/tag-option';
import { isCellValueChanged } from '@/sea-metadata/utils/cell';
import { getRowById, getRowsByIds } from '@/sea-metadata/utils/row';
import Tag from '@/sea-metadata/components/tag';
import RemoveBtn from '@/sea-metadata/components/tag/remove-btn';

import './index.css';

const TagsEditor = forwardRef(({
  height,
  column,
  value: propsValue,
  editorPosition = { left: 0, top: 0 },
  onCommit,
  onPressTab,
}, ref) => {
  const [value, setValue] = useState(propsValue || []);

  const editorRef = useRef(null);
  const optionEditorContainerRef = useRef(null);

  const { tagsData, createTag } = useTagsData();

  const options = useMemo(() => {
    if (!tagsData?.rows) return [];
    return tagsData.rows.map(tag => {
      return {
        ...tag,
        value: tag._id,
        label: <TagOption tag={tag} />,
      };
    });
  }, [tagsData]);

  const style = useMemo(() => {
    return { width: 400, top: -1, right: 0 };
  }, [column, height]);

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

  const handleChange = useCallback((newValue) => {
    const _newValue = Array.isArray(newValue) && newValue.length > 0 ? newValue.map(v => Number(v)) : newValue;
    if (!isCellValueChanged(_newValue, value)) return;
    let validValue = newValue;
    if (Array.isArray(newValue) && newValue.length > 0) {
      const tags = getRowsByIds(tagsData, newValue);
      validValue = tags.map(tag => Number(tag._id));
    }
    setValue(validValue);
  }, [tagsData, value]);

  const handleDeselect = useCallback((tagId) => {
    const newValue = value.filter(v => v !== tagId);
    optionEditorContainerRef.current?.setValue(newValue);
    setValue(newValue);
  }, [value]);

  useEffect(() => {
    if (editorRef.current) {
      const { bottom, right } = editorRef.current.getBoundingClientRect();
      if (bottom > window.innerHeight) {
        editorRef.current.style.top = 'unset';
        editorRef.current.style.bottom = editorPosition.top + height - window.innerHeight + 'px';
      }
      if (right > window.innerWidth) {
        editorRef.current.style.right = right - window.innerWidth - 10 + 'px';
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    getValue: () => {
      const { key } = column;
      return { [key]: value };
    },
    onBlur: () => {
      onCommit && onCommit(true);
    },
  }), [value, column, onCommit]);

  return (
    <div
      className={classnames('sea-metadata-tags-selector-popover sea-qa-tags-selector-popover option-editor-popover', { 'hide-description': true })}
      style={style}
      ref={editorRef}
    >
      <OptionEditorContainer
        ref={optionEditorContainerRef}
        isMultiple={true}
        optionHeight="fit-content"
        placeholder={gettext('Search tags')}
        emptyTip={gettext('No tags available')}
        value={Array.isArray(value) ? value.map(v => String(v)) : []}
        options={options}
        onChange={handleChange}
        onCreate={context.canModify() ? handleCreateTag : null}
        onPressTab={onPressTab}
      >
        {Array.isArray(value) && value.map(v => {
          const tag = getRowById(tagsData, v);
          return (
            <Tag tag={tag} key={v} className="mr-0">
              <RemoveBtn callback={() => handleDeselect(v)} />
            </Tag>
          );
        })}
      </OptionEditorContainer>
    </div>
  );
});

TagsEditor.propTypes = {
  height: PropTypes.number,
  column: PropTypes.object,
  row: PropTypes.object,
  value: PropTypes.array,
  editorPosition: PropTypes.object,
  onCommit: PropTypes.func,
  onPressTab: PropTypes.func,
};

export default TagsEditor;
