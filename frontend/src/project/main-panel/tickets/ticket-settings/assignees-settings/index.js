import React, { useCallback, useRef, useState } from 'react';
import { Label } from 'reactstrap';
import classnames from 'classnames';
import { gettext } from '../../../../../constants';
import { Collaborator, CollaboratorEditor } from '../../../../../components';

import './index.css';

const AssigneesSettings = ({
  isReadonly,
  assignees,
  collaborators,
  className = 'mb-4',
  onChange,
}) => {
  const [isShowAssigneesEditor, setIsShowAssigneesEditor] = useState(false);

  const assigneesRef = useRef(null);

  const deleteAssignee = useCallback((email) => {
    const newValue = assignees.filter(i => i !== email);
    onChange(newValue);
  }, [assignees, onChange]);

  const onAssigneesChange = useCallback((assignees) => {
    onChange(assignees);
    setIsShowAssigneesEditor(false);
  }, [onChange]);

  const openAssigneesEditor = useCallback(() => {
    if (isReadonly) return;
    setIsShowAssigneesEditor(true);
  }, [isReadonly]);

  const closeAssigneesEditor = useCallback(() => {
    setIsShowAssigneesEditor(false);
  }, []);

  return (
    <>
      <div className={classnames('sea-qa-project-ticket-settings-item', className)}>
        <Label>{gettext('Assignees')}</Label>
        <div className="collaborators-formatter" onClick={openAssigneesEditor} ref={assigneesRef}>
          {assignees.length > 0 ? assignees.map(assignee => {
            if (!assignee) return null;
            const collaborator = collaborators.find(c => c.email === assignee);
            return (
              <Collaborator collaborator={collaborator} key={assignee}>
                {!isReadonly && (<Collaborator.RemoveBtn callback={() => deleteAssignee(assignee)} />)}
              </Collaborator>
            );
          }) : (<div className="tip-default">{gettext('No one assigned')}</div>)}
        </div>
      </div>
      {!isReadonly && isShowAssigneesEditor && (
        <CollaboratorEditor
          target={assigneesRef}
          value={assignees}
          placeholder={gettext('Search assignees')}
          emptyTip={gettext('No assignees')}
          collaborators={collaborators}
          onChange={onAssigneesChange}
          onClose={closeAssigneesEditor}
        />
      )}
    </>
  );
};

export default AssigneesSettings;
