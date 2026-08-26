import React, { useCallback, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { OptionsEditor, RemoveButton, Option } from '@/components';
import { gettext } from '@/constants';
import { useTypesData } from '@/sea-metadata/hooks';
import { getTypesOptions } from '@/sea-metadata/utils/column';
import SelectTrigger from '@/components/customize-select/select-trigger';

const TypeFilter = ({ readOnly = true, value = [], onChange: onChangeAPI }) => {
  const [isShowEditor, setIsShowEditor] = useState(false);
  const typeFilterRef = useRef(null);
  const { typesData } = useTypesData();

  const validOptions = useMemo(() => getTypesOptions(typesData), [typesData]);

  const options = useMemo(() => {
    if (!Array.isArray(validOptions) || validOptions.length === 0) return [];
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

  const validValue = Array.isArray(value) ? value : [];

  return (
    <>
      <SelectTrigger
        innerRef={typeFilterRef}
        disabled={readOnly}
        focus={isShowEditor}
        className={classnames('sea-metadata-basic-filters-select', { 'highlighted': validValue.length > 0 })}
        selectedValue={(<span className="selected-option-show">{gettext('Type')}</span>)}
        onClick={openEditor}
      />
      {isShowEditor && (
        <OptionsEditor
          className="sea-metadata-data-filter-popover"
          value={validValue}
          isMultiple={true}
          target={typeFilterRef}
          options={options}
          emptyTip={gettext('No types available')}
          placeholder={gettext('Search type')}
          sameWidthWithTarget={300}
          onChange={onChangeAPI}
          onToggle={closeEditor}
        >
          {({ value, onChange }) => {
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
          }}
        </OptionsEditor>
      )}
    </>
  );
};

export default TypeFilter;
