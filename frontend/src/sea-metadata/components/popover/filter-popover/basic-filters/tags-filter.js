import { useCallback, useState, useRef } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import SelectTrigger from '@/components/customize-select/select-trigger';
import { gettext } from '@/constants';
import { useTagsData } from '@/sea-metadata/hooks';
import { getRowById } from '@/sea-metadata/utils/row';
import { TagSelector } from '../../../selectors';

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
          onChange={onChange}
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
