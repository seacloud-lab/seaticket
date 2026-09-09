import React from 'react';
import { gettext } from '@/constants';
import TypesComponent from '@/project/main-panel/tickets/view/types';
import { CellType } from '@/sea-metadata';
import { PORTAL_ISSUE_TYPE } from '../../constants';
import { usePortalIssuesMetadata } from '../../hooks';

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
      type={PORTAL_ISSUE_TYPE}
      columns={initColumns}
      useMetadataContext={usePortalIssuesMetadata}
    />
  );
};

export default Types;
