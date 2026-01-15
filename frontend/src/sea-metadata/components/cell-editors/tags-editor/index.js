import React, { forwardRef, useMemo, useImperativeHandle, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import context from '@/sea-metadata/context';
import Main from '@/components/option-editor/main';
import { gettext } from '@/constants';
import { SELECT_OPTION_COLORS } from '../../../constants';
import { useTagsData } from '../../../hooks';

import './index.css';

const TagsEditor = forwardRef(({
  height,
  column,
  value,
  editorPosition = { left: 0, top: 0 },
  onCommit,
  onPressTab,
}, ref) => {
  const editorRef = useRef(null);
  const mainRef = useRef(null);

  const { tagsData, createTag } = useTagsData();

  const options = useMemo(() => {
    if (!tagsData?.rows) return [];
    return tagsData.rows.map(tag => {
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
  }, [tagsData]);

  const style = useMemo(() => {
    return { width: 400, top: height - 2 };
  }, [column, height]);

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

  const onSubmit = useCallback(() => {
    setTimeout(() => onCommit && onCommit(false), 1);
  }, [onCommit]);

  useEffect(() => {
    if (editorRef.current) {
      const { bottom, right } = editorRef.current.getBoundingClientRect();
      if (bottom > window.innerHeight) {
        editorRef.current.style.top = 'unset';
        editorRef.current.style.bottom = editorPosition.top + height - window.innerHeight + 'px';
      }
      if (right > window.innerWidth) {
        editorRef.current.style.left = 'unset';
        editorRef.current.style.right = 0;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    getValue: () => {
      const { key } = column;
      const value = mainRef.current.getValue();
      return { [key]: value };
    },
    onBlur: () => {
      onCommit && onCommit(true);
    },

  }), [column, onCommit]);

  return (
    <div className="sea-metadata-tags-selector-popover sea-qa-tags-selector-popover option-editor-popover" style={style} ref={editorRef}>
      <Main
        ref={mainRef}
        isMultiple={true}
        optionHeight="fit-content"
        placeholder={gettext('Search tags')}
        emptyTip={gettext('No tags available')}
        value={value}
        options={options}
        onChange={onSubmit}
        onCreate={context.canModify() ? handleCreateTag : null}
        onPressTab={onPressTab}
      />
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
