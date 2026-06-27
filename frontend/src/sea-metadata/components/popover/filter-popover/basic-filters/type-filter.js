import React, { useCallback, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { ClickOutside, Icon } from '@/components';
import OptionEditorContainer from '@/components/option-editor/option-editor-container';
import SelectOption from '@/sea-metadata/components/cell-formatter/select-option';
import { gettext } from '@/constants';
import { useTypesData } from '@/sea-metadata/hooks';
import { getRowById, getRowsByIds } from '@/sea-metadata/utils/row';

import './type-filter.css';

const TypeFilter = ({ readOnly = true, value = [], onChange: onChangeAPI }) => {
  const [isShowEditor, setIsShowEditor] = useState(false);
  const optionEditorContainerRef = useRef(null);
  const { typesData } = useTypesData();

  const options = useMemo(() => {
    if (!typesData?.rows) return [];
    return typesData.rows.map(type => {
      const { _id } = type;
      return {
        ...type,
        value: `${_id}`,
        label: <SelectOption option={type} className="seaqa-type-filter-option-name" />,
      };
    });
  }, [typesData]);

  const openEditor = useCallback(() => {
    if (readOnly) return;
    setIsShowEditor(true);
  }, [readOnly]);

  const closeEditor = useCallback(() => {
    const newValue = optionEditorContainerRef.current.getValue();
    const normalizedValue = Array.isArray(newValue) ? newValue.map(v => `${v}`) : newValue;
    const validValue = Array.isArray(normalizedValue)
      ? getRowsByIds(typesData, normalizedValue).map(type => `${type._id}`)
      : normalizedValue;
    onChangeAPI(validValue);
    setIsShowEditor(false);
  }, [typesData, onChangeAPI]);

  const handleChange = useCallback((newValue) => {
    const nextValue = Array.isArray(newValue)
      ? Array.from(new Set(newValue.map(v => `${v}`))).filter(Boolean)
      : [`${newValue}`].filter(Boolean);
    optionEditorContainerRef.current?.setValue(nextValue);
    onChangeAPI(nextValue);
  }, [onChangeAPI]);

  const handleDeselect = useCallback((typeId) => {
    const newValue = (Array.isArray(value) ? value : []).filter(v => `${v}` !== `${typeId}`);
    optionEditorContainerRef.current?.setValue(newValue.map(v => `${v}`));
    onChangeAPI(newValue);
  }, [value, onChangeAPI]);

  const handleClearAll = useCallback(() => {
    optionEditorContainerRef.current?.setValue([]);
    onChangeAPI([]);
  }, [onChangeAPI]);

  const validValue = Array.isArray(value) ? value.map(v => `${v}`) : [];
  const selectedTypes = validValue.map(id => getRowById(typesData, id)).filter(Boolean);

  return (
    <div className={classnames('seaqa-select custom-select seaqa-customize-select sea-metadata-basic-filters-select position-relative mr-4', 'seaqa-type-filter', {
      'highlighted': validValue.length > 0
    })}>
      <div className="selected-option" onClick={openEditor} role="button">
        <span className="selected-option-show">{gettext('Type')}</span>
        {!readOnly && (<Icon symbol="arrow-down" />)}
      </div>
      {isShowEditor && (
        <ClickOutside onClickOutside={closeEditor}>
          <div className="sea-metadata-type-selector-popover popover seaqa-type-selector-popover option-editor-popover sea-metadata-basic-filter-type-selector hide-description seaqa-type-filter seaqa-type-filter-popover">
            <OptionEditorContainer
              ref={optionEditorContainerRef}
              isMultiple={true}
              placeholder={gettext('Search types')}
              emptyTip={gettext('No types available')}
              value={validValue}
              options={options}
              onChange={handleChange}
              isShowClearIcon={false}
              searchHeight={32}
            >
              {(Array.isArray(value) && value.length > 0) && (
                <div className="seaqa-type-filter-selected-wrapper w-100">
                  <div className="seaqa-type-filter-selected-list">
                    {selectedTypes.map(type => {
                      const typeId = `${type._id}`;
                      return (
                        <SelectOption
                          option={type}
                          className="seaqa-type-filter-tag"
                          key={typeId}
                          children={
                            <span
                              className="seaqa-type-filter-remove-tag"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeselect(typeId);
                              }}
                              role="button"
                              aria-label={gettext('Remove type')}
                              title={gettext('Remove type')}
                            >
                              <Icon symbol="close" />
                            </span>
                          }
                        />
                      );
                    })}
                  </div>
                  <div
                    className="seaqa-type-filter-clear-all-wrapper"
                    onClick={handleClearAll}
                    role="button"
                    aria-label={gettext('Clear all types')}
                    title={gettext('Clear all types')}
                  >
                    <Icon symbol="close" className="seaqa-type-filter-clear-all" />
                  </div>
                </div>
              )}
            </OptionEditorContainer>
          </div>
        </ClickOutside>
      )}
    </div>
  );
};

export default TypeFilter;
