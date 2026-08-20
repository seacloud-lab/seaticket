import React, { useMemo, useState, useRef, useCallback } from 'react';
import {
  DELETED_OPTION_BACKGROUND_COLOR, DELETED_OPTION_TIPS,
} from '../../constants';
import { OptionsEditor } from '@/components';
import SelectOption from '@/sea-metadata/components/cell-formatter/select-option';
import { getOption } from '@/sea-metadata/utils/column';
import { gettext } from '@/constants';
import SelectTrigger from '@/components/customize-select/select-trigger';
import { isFilterTermArray } from '@/sea-metadata/utils/filter';

const OptionSelector = ({
  readOnly,
  column,
  value: filterTerm,
  options,
  predicate,
  onChange,
}) => {
  const [isShowEditor, setIsShowEditor] = useState(false);

  const optionSelectorRef = useRef(null);

  const isMultiple = useMemo(() => {
    return isFilterTermArray(column, predicate);
  }, [column, predicate]);

  const valueForSelectOptions = useMemo(() => {
    if (Array.isArray(filterTerm)) return filterTerm;
    return filterTerm ? [filterTerm] : [];
  }, [filterTerm]);

  const optionsForSelector = useMemo(() => {
    if (!Array.isArray(options) || options.length === 0) return [];
    return options.map(option => ({
      value: option.id,
      name: option.name,
      label: (<SelectOption option={option} className="single-select-option ml-0" />),
    }));
  }, [options]);

  const openEditor = useCallback(() => {
    if (readOnly) return;
    setIsShowEditor(true);
  }, [readOnly]);

  const closeEditor = useCallback(() => {
    setIsShowEditor(false);
  }, []);

  const selectedValue = (
    <>
      {valueForSelectOptions.length > 0 ? (
        <span className="selected-option-show">
          {valueForSelectOptions.map(item => {
            const option = getOption(options, item) || { color: DELETED_OPTION_BACKGROUND_COLOR, name: DELETED_OPTION_TIPS };
            return (<SelectOption key={item} option={option} />);
          })}
        </span>
      ) : (
        <span className="select-placeholder">{gettext('No options')}</span>
      )}
    </>
  );

  return (
    <>
      <SelectTrigger
        innerRef={optionSelectorRef}
        disabled={readOnly}
        focus={isShowEditor}
        selectedValue={selectedValue}
        onClick={openEditor}
      />
      {isShowEditor && (
        <OptionsEditor
          className="sea-metadata-data-filter-popover"
          value={filterTerm}
          isMultiple={isMultiple}
          target={optionSelectorRef}
          options={optionsForSelector}
          emptyTip={gettext('No options available')}
          placeholder={gettext('Search options')}
          sameWidthWithTarget={300}
          onChange={onChange}
          onToggle={closeEditor}
        />
      )}
    </>
  );
};

export default OptionSelector;
