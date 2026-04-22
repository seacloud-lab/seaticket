import React from 'react';
import { usePortalIssuesMetadata } from '../../hooks';
import AllSubstates from '@/project/main-panel/tickets/view/substates';
import { gettext } from '@/constants';
import { CellType } from '@/sea-metadata';
import { PORTAL_ISSUE_TYPE } from '../../constants';

const initColumns = [
  {
    type: CellType.SINGLE_SELECT,
    key: 'name',
    name: 'name',
    display_name: gettext('Substate'),
    editable: false,
    is_name_column: true,
    frozen: true,
  }, {
    type: CellType.TEXT,
    key: 'description',
    name: 'description',
    display_name: gettext('Description'),
    editable: true,
    is_required: false,
  }, {
    type: CellType.NUMBER,
    key: 'issues_count',
    name: 'issues_count',
    display_name: gettext('Issues count'),
    editable: false,
  },
];

const Substates = (props) => {
  return (
    <AllSubstates
      { ...props }
      type={PORTAL_ISSUE_TYPE}
      columns={initColumns}
      useMetadataContext={usePortalIssuesMetadata}
    />
  );
};

export default Substates;
