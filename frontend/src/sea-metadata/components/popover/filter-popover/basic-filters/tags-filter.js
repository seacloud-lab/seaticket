import { useCallback, useState, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { useTagsData } from '@/sea-metadata/hooks';
import { gettext } from '@/constants';
import { ClickOutside, Icon } from '@/components';
import OptionEditorContainer from '@/components/option-editor/option-editor-container';
import { getRowById, getRowsByIds } from '@/sea-metadata/utils/row';
import Tag from '@/sea-metadata/components/tag';
import RemoveBtn from '@/sea-metadata/components/tag/remove-btn';
import { isCellValueChanged } from '@/sea-metadata/utils/cell';
import TagOption from '@/components/tag-option';

import '../../../cell-editors/tags-editor/index.css';

const TagsFilter = ({ readOnly, value, onChange }) => {
  const [isShowEditor, setIsShowEditor] = useState(false);
  const editorRef = useRef(null);
  const optionEditorContainerRef = useRef(null);
  const { tagsData } = useTagsData();

  const tagOptions = useMemo(() => {
    if (!tagsData?.rows) return [];
    return tagsData.rows.map(tag => ({
      ...tag,
      value: tag._id,
      label: <TagOption tag={tag} />,
    }));
  }, [tagsData]);

  const openEditor = useCallback(() => {
    if (readOnly) return;
    setIsShowEditor(true);
  }, [readOnly]);

  const closeEditor = useCallback(() => {
    const newValue = optionEditorContainerRef.current.getValue();
    const _newValue = Array.isArray(newValue) && newValue.length > 0 ? newValue.map(v => Number(v)) : newValue;
    if (isCellValueChanged(_newValue, value)) {
      let validValue = newValue;
      if (Array.isArray(newValue) && newValue.length > 0) {
        const tags = getRowsByIds(tagsData, newValue);
        validValue = tags.map(tag => Number(tag._id));
      }
      onChange?.(validValue);
    }
    setIsShowEditor(false);
  }, [value, onChange]);

  const handleChange = useCallback((newValue) => {
    const _newValue = Array.isArray(newValue) && newValue.length > 0 ? newValue.map(v => Number(v)) : newValue;
    if (!isCellValueChanged(_newValue, value)) return;
    let validValue = newValue;
    if (Array.isArray(newValue) && newValue.length > 0) {
      const tags = getRowsByIds(tagsData, newValue);
      validValue = tags.map(tag => Number(tag._id));
    }
    onChange?.(validValue);
  }, [value, onChange]);

  const handleDeselect = useCallback((tagId) => {
    const newValue = value.filter(v => v !== tagId);
    optionEditorContainerRef.current?.setValue(newValue);
    onChange?.(newValue);
  }, [value, onChange]);

  let validValue = Array.isArray(value) ? value.map(v => v + '') : [];
  validValue = validValue.filter(id => getRowById(tagsData, id));

  return (
    <>
      <div
        ref={editorRef}
        className={classnames('sea-qa-select custom-select sea-qa-customize-select sea-metadata-basic-filters-select position-relative mr-4', {
          'highlighted': validValue.length > 0
        })}
      >
        <div className="selected-option" onClick={openEditor} >
          <span className="selected-option-show">{gettext('Tags')}</span>
          {!readOnly && (<Icon symbol="arrow-down" />)}
        </div>
        {isShowEditor && (
          <ClickOutside onClickOutside={closeEditor}>
            <div className="sea-metadata-tags-selector-popover sea-qa-tags-selector-popover option-editor-popover sea-metadata-basic-filter-tags-selector hide-description">
              <OptionEditorContainer
                ref={optionEditorContainerRef}
                isMultiple={true}
                placeholder={gettext('Search tags')}
                emptyTip={gettext('No tags')}
                value={validValue}
                options={tagOptions}
                onChange={handleChange}
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
          </ClickOutside>
        )}
      </div>
    </>
  );
};

TagsFilter.propTypes = {
  readOnly: PropTypes.bool,
  value: PropTypes.array,
  onChange: PropTypes.func,
};

export default TagsFilter;
