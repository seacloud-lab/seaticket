import React from 'react';
import { usePortalIssuesMetadata } from '../../hooks';
import TypesComponent from '@/project/main-panel/tickets/view/types';
import { gettext } from '@/constants';
import { CellType } from '@/sea-metadata';

const initColumns = [
  {
    type: CellType.SINGLE_SELECT,
    key: 'name',
    name: 'name',
    display_name: gettext('Type'),
    editable: false,
    is_name_column: true,
    frozen: true,
  },
  {
    type: CellType.NUMBER,
    key: 'issues_count',
    name: 'issues_count',
    display_name: gettext('Issues count'),
    editable: false,
  },
];

const Types = (props) => {
  return (
    <TypesComponent
      { ...props }
      columns={initColumns}
      useMetadataProvider={usePortalIssuesMetadata}
    />
  );
};

export default Types;
