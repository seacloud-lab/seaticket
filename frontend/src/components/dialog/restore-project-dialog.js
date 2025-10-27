import React, { useMemo } from 'react';
import { gettext } from '@/constants';
import CommonOperationConfirmationDialog from './common-operation-confirmation-dialog';

const RestoreProjectDialog = ({
  project,
  onRestore,
  onToggle,
}) => {
  const message = useMemo(() => {
    const name = project.name;
    if (project.owner_deleted) {
      return gettext('The owner of this project has been deleted. Do you want to restore the project to your account?');
    }
    return gettext('Are you sure you want to restore {placeholder} ?').replace('{placeholder}', `<b>${name}</b>`);
  }, [project]);

  return (
    <CommonOperationConfirmationDialog
      title={gettext('Restore project')}
      message={message}
      executeOperation={() => onRestore && onRestore(project.uuid)}
      confirmBtnText={gettext('Restore')}
      toggleDialog={onToggle}
    />
  );
};

export default RestoreProjectDialog;
