import React, { useMemo } from 'react';
import { IconButton } from '@/components';
import { gettext } from '@/constants';
import { COLUMNS_ICON_CONFIG } from '@/sea-metadata/constants';
import { useSeaMetadataContext } from '../../../context-provider';
import CustomizeSelect from '../scoped-select';

import './index.css';

const ColumnSelector = ({
  disabled,
  value,
  columns,
  onChange,
}) => {
  const context = useSeaMetadataContext();
  const options = useMemo(() => {
    return Array.isArray(columns) && columns.length > 0 ? columns.map(c => {
      const name = c.display_name || c.name || '';
      return {
        value: c.key,
        name: name,
        label: (
          <div
            className="sea-metadata-column-option d-flex align-items-center o-hidden"
            title={name}
            aria-label={name}
            key={c.key}
          >
            <IconButton
              icon={COLUMNS_ICON_CONFIG[c.type]}
              className="sea-metadata-column-option-icon-btn"
              size={14}
            />
            <div className="sea-metadata-column-option-name text-truncate">{name}</div>
          </div>
        ),
      };
    }) : [];
  }, [columns]);

  return (
    <CustomizeSelect
      disabled={disabled}
      value={value}
      options={options}
      containerClassName="sea-metadata-columns-select-container"
      searchable={true}
      isInModal={true}
      searchPlaceholder={context.translate('Search {column}')}
      noOptionsPlaceholder={gettext('No results')}
      onChange={onChange}
    />
  );
};

export default ColumnSelector;
