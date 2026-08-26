import React, { useMemo, useState, useRef, useCallback } from 'react';
import classnames from 'classnames';
import {
  DELETED_OPTION_BACKGROUND_COLOR, DELETED_OPTION_TIPS,
} from '../../constants';
import { OptionsEditor, RemoveButton, Option } from '@/components';
import { getOption } from '@/sea-metadata/utils/column';
import { gettext } from '@/constants';
import SelectTrigger from '@/components/customize-select/select-trigger';
import { isFilterTermArray } from '@/sea-metadata/utils/filter';

const OptionSelector = ({
  readOnly,
  className,
  column,
  value: filterTerm,
  options = [],
  predicate,
  onChange,
}) => {
  const [isShowEditor, setIsShowEditor] = useState(false);

  const optionSelectorRef = useRef(null);

  const isMultiple = useMemo(() => isFilterTermArray(column, predicate), [column, predicate]);

  const valueForSelectOptions = useMemo(() => {
    if (Array.isArray(filterTerm)) return filterTerm;
    return filterTerm ? [filterTerm] : [];
  }, [filterTerm]);

  const validOptions = useMemo(() => {
    if (!Array.isArray(options) || options.length === 0) return [];
    return options;
  }, [options]);

  const optionsForSelector = useMemo(() => {
    return validOptions.map(option => ({
      value: option.id,
      name: option.name,
      label: (<Option option={option} />),
    }));
  }, [validOptions]);

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
            return (<Option key={item} option={option} />);
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
          className={classnames('sea-metadata-data-filter-popover', className)}
          value={filterTerm}
          isMultiple={isMultiple}
          target={optionSelectorRef}
          options={optionsForSelector}
          emptyTip={gettext('No options available')}
          placeholder={gettext('Search options')}
          sameWidthWithTarget={300}
          onChange={onChange}
          onToggle={closeEditor}
        >
          {isMultiple ? ({ value, onChange }) => {
            if (value.length === 0) return null;
            return value.map(item => {
              const option = validOptions.find(c => c.id === item);
              if (!option) return null;
              return (
                <Option option={option}>
                  <RemoveButton callback={() => onChange(item)} size={10} iconStyle={{ color: option.text_color }} />
                </Option>
              );
            });
          } : null}
        </OptionsEditor>
      )}
    </>
  );
};

export default OptionSelector;
