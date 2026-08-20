import { useCallback, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { useTagsData } from '@/sea-metadata/hooks';
import { gettext } from '@/constants';
import { getRowById, getRowsByIds } from '@/sea-metadata/utils/row';
import { isCellValueChanged } from '@/sea-metadata/utils/cell';
import { TagSelector } from '../../../selectors';
import SelectTrigger from '@/components/customize-select/select-trigger';

import '../../../cell-editors/tags-editor/index.css';

const TagsFilter = ({ readOnly, value, onChange }) => {
  const [isShowEditor, setIsShowEditor] = useState(false);
  const editorRef = useRef(null);

  const { tagsData } = useTagsData();

  const openEditor = useCallback(() => {
    if (readOnly) return;
    setIsShowEditor(true);
  }, [readOnly]);

  const closeEditor = useCallback(() => {
    setIsShowEditor(false);
  }, []);

  const handleChange = useCallback((newValue) => {
    const _newValue = Array.isArray(newValue) && newValue.length > 0 ? newValue.map(v => Number(v)) : newValue;
    if (!isCellValueChanged(_newValue, value)) return;
    let validValue = newValue;
    if (Array.isArray(newValue) && newValue.length > 0) {
      const tags = getRowsByIds(tagsData, newValue);
      validValue = tags.map(tag => Number(tag._id));
    }
    onChange?.(validValue);
  }, [value, tagsData, onChange]);

  let validValue = Array.isArray(value) ? value.map(v => v + '') : [];
  validValue = validValue.filter(id => getRowById(tagsData, id));

  return (
    <>
      <SelectTrigger
        innerRef={editorRef}
        disabled={readOnly}
        focus={isShowEditor}
        className={classnames('sea-metadata-basic-filters-select', { 'highlighted': validValue.length > 0 })}
        selectedValue={(<span className="selected-option-show">{gettext('Tags')}</span>)}
        onClick={openEditor}
      />
      {isShowEditor && (
        <TagSelector
          target={editorRef}
          value={value}
          onChange={handleChange}
          onToggle={closeEditor}
        />
      )}
    </>
  );
};

TagsFilter.propTypes = {
  readOnly: PropTypes.bool,
  value: PropTypes.array,
  onChange: PropTypes.func,
};

export default TagsFilter;
