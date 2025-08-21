import { useCallback, useState, useMemo, useRef } from 'react';
import classnames from 'classnames';
import { useTagsData } from '@/sea-metadata/hooks';
import { gettext } from '@/constants';
import { ClickOutside, Icon } from '@/components';
import Main from '@/components/option-editor/main';
import { getRowById } from '@/sea-metadata/utils/row';
import Tag from '@/sea-metadata/components/tag';

const TagsFilter = ({
  readOnly,
  value,
  onChange,
}) => {
  const [isShowEditor, setIsShowEditor] = useState(false);

  const editorRef = useRef(null);
  const mainRef = useRef(null);

  const { tagsData } = useTagsData();

  const tagOptions = useMemo(() => {
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
  }, [tagsData]);

  const openEditor = useCallback(() => {
    if (readOnly) return;
    setIsShowEditor(true);
  }, [readOnly]);

  const closeEditor = useCallback(() => {
    const value = mainRef.current.getValue();
    onChange && onChange(value);
    setIsShowEditor(false);
  }, [onChange]);

  const handleChange = useCallback((value) => {
    onChange && onChange(value);
  }, [onChange]);

  const handleDeselect = useCallback((tagId) => {
    const newValue = value.filter(v => v !== tagId);
    mainRef.current.setValue(newValue);
    onChange && onChange(newValue);
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
          <Icon symbol="down" />
        </div>
        {isShowEditor && (
          <ClickOutside onClickOutside={closeEditor}>
            <div className="sea-metadata-tags-selector-popover sea-qa-tags-selector-popover option-editor-popover sea-metadata-basic-filter-tags-selector">
              <Main
                ref={mainRef}
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
                    <Tag tag={tag} className="mr-0">
                      <Tag.RemoveBtn callback={() => handleDeselect(v)} />
                    </Tag>
                  );
                })}
              </Main>
            </div>
          </ClickOutside>
        )}
      </div>
    </>
  );
};

export default TagsFilter;
