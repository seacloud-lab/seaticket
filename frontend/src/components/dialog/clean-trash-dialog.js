import React from 'react';
import { gettext } from '@/constants';
import CommonOperationConfirmationDialog from './common-operation-confirmation-dialog';

const ClearTrashDialog = ({
  onClear,
  onToggle,
}) => {

  return (
    <CommonOperationConfirmationDialog
      title={gettext('Clean')}
      message={gettext('Are you sure to clean the trash?')}
      executeOperation={() => onClear && onClear()}
      confirmBtnText={gettext('Clean')}
      toggleDialog={onToggle}
    />
  );
};

export default ClearTrashDialog;
