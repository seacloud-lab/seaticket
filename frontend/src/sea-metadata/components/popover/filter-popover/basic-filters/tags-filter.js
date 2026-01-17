import { useCallback, useState, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { useTagsData } from '@/sea-metadata/hooks';
import { gettext } from '@/constants';
import { ClickOutside, Icon } from '@/components';
import OptionEditorContainer from '@/components/option-editor/option-editor-container';
import { getRowById } from '@/sea-metadata/utils/row';
import Tag from '@/sea-metadata/components/tag';
import { isCellValueChanged } from '@/sea-metadata/utils/cell';

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
      label: (
        <>
          <div
            className="sea-qa-tags-selector-tag-bg"
            style={{ backgroundColor: tag.color }}
          />
          <div className="sea-qa-tags-selector-tag-name-description">
            <div className="sea-qa-tags-selector-tag-name">{tag.name}</div>
            {tag.description && (
              <div className="sea-qa-tags-selector-tag-description">
                {tag.description}
              </div>
            )}
          </div>
        </>
      ),
    }));
  }, [tagsData]);

  const openEditor = useCallback(() => {
    if (readOnly) return;
    setIsShowEditor(true);
  }, [readOnly]);

  const closeEditor = useCallback(() => {
    const newValue = optionEditorContainerRef.current.getValue();
    if (isCellValueChanged(newValue, value)) {
      onChange?.(newValue);
    }
    setIsShowEditor(false);
  }, [value, onChange]);

  const handleChange = useCallback((newValue) => {
    if (!isCellValueChanged(newValue, value)) return;
    onChange?.(newValue);
  }, [value, onChange]);

  const handleDeselect = useCallback((tagId) => {
    const newValue = value.filter(v => v !== tagId);
    optionEditorContainerRef.current?.setValue(newValue);
    onChange?.(newValue);
  }, [value, onChange]);

  return (
    <>
      <div
        ref={editorRef}
        className={classnames('sea-qa-select custom-select sea-qa-customize-select sea-metadata-basic-filters-select position-relative mr-4', {
          'highlighted': value.length > 0
        })}
      >
        <div className="selected-option" onClick={openEditor} >
          <span className="selected-option-show">{gettext('Tags')}</span>
          {!readOnly && (<Icon symbol="arrow-down" />)}
        </div>
        {isShowEditor && (
          <ClickOutside onClickOutside={closeEditor}>
            <div className="sea-metadata-tags-selector-popover sea-qa-tags-selector-popover option-editor-popover sea-metadata-basic-filter-tags-selector">
              <OptionEditorContainer
                ref={optionEditorContainerRef}
                isMultiple={true}
                placeholder={gettext('Search tags')}
                emptyTip={gettext('No tags')}
                value={value}
                options={tagOptions}
                onChange={handleChange}
              >
                {Array.isArray(value) && value.map(v => {
                  const tag = getRowById(tagsData, v);
                  return (
                    <Tag tag={tag} key={v} className="mr-0">
                      <Tag.RemoveBtn callback={() => handleDeselect(v)} />
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
