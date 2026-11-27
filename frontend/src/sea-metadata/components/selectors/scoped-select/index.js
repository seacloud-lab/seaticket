import React from 'react';
import CustomizeSelect from '@/components/customize-select';
import { useSeaMetadataContext } from '../../../context-provider';

// Keep portalled menus in the same event scope as their table.
const ScopedSelect = ({ menuAttributes, ...props }) => {
  const context = useSeaMetadataContext();
  return (
    <CustomizeSelect
      {...props}
      menuAttributes={{ ...menuAttributes, 'data-sea-metadata-instance': context.id, 'data-sea-metadata-popover': '' }}
    />
  );
};

export default ScopedSelect;
