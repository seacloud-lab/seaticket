import React, { useCallback, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { OptionsEditor } from '@/components';
import SelectOption from '@/sea-metadata/components/cell-formatter/select-option';
import { gettext } from '@/constants';
import { useTypesData } from '@/sea-metadata/hooks';
import { getTypesOptions } from '@/sea-metadata/utils/column';
import SelectTrigger from '@/components/customize-select/select-trigger';

const TypeFilter = ({ readOnly = true, value = [], onChange: onChangeAPI }) => {
  const [isShowEditor, setIsShowEditor] = useState(false);
  const typeFilterRef = useRef(null);
  const { typesData } = useTypesData();

  const options = useMemo(() => {
    const _options = getTypesOptions(typesData);
    if (!Array.isArray(_options) || _options.length === 0) return [];
    return _options.map(option => ({
      value: option.id,
      name: option.name,
      label: (<SelectOption option={option} className="single-select-option ml-0" />),
    }));
  }, [typesData]);

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
        />
      )}
    </>
  );
};

export default TypeFilter;
