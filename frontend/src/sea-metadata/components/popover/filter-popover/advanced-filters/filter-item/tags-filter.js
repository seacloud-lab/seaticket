import React, { useMemo, useState, useRef, useCallback } from 'react';
import SelectTrigger from '@/components/customize-select/select-trigger';
import { gettext } from '@/constants';
import Tag from '@/sea-metadata/components/tag';
import { useTagsData } from '@/sea-metadata/hooks';
import { isFilterTermArray } from '@/sea-metadata/utils/filter';
import { getRowById } from '@/sea-metadata/utils/row';
import {
  DELETED_OPTION_BACKGROUND_COLOR, DELETED_TAG_TIPS,
} from '../../../../../constants';
import { TagSelector } from '../../../../selectors';

const TagsFilter = ({
  readOnly,
  value,
  predicate,
  column,
  onChange,
}) => {
  const [isShowEditor, setIsShowEditor] = useState(false);

  const tagsFilterRef = useRef(null);

  const { tagsData } = useTagsData();

  const isMultiple = useMemo(() => isFilterTermArray(column, predicate), [column, predicate]);

  const openEditor = useCallback(() => {
    if (readOnly) return;
    setIsShowEditor(true);
  }, [readOnly]);

  const closeEditor = useCallback(() => {
    setIsShowEditor(false);
  }, []);

  return (
    <>
      <SelectTrigger
        innerRef={tagsFilterRef}
        disabled={readOnly}
        focus={isShowEditor}
        selectedValue={(
          <>
            {Array.isArray(value) && value.length > 0 ? (
              <span className="selected-option-show">
                {value.map(item => {
                  const tag = getRowById(tagsData, item + '') || { color: DELETED_OPTION_BACKGROUND_COLOR, name: DELETED_TAG_TIPS };
                  return (<Tag className="d-inline-flex flex-shrink-0" tag={tag} key={'option_' + item} />);
                })}
              </span>
            ) : (
              <span className="select-placeholder">{gettext('No tags')}</span>
            )}
          </>
        )}
        onClick={openEditor}
      />
      {!readOnly && isShowEditor && (
        <TagSelector
          target={tagsFilterRef}
          value={value}
          onChange={onChange}
          onToggle={closeEditor}
          isMultiple={isMultiple}
        />
      )}
    </>
  );

};

export default TagsFilter;
