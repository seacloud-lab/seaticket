import React, { useCallback, useRef, useState } from 'react';
import { Label } from 'reactstrap';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { Collaborator, AsyncCollaborator, CollaboratorEditor } from '@/components';
import { useCollaborators } from '@/sea-metadata';

import './index.css';

const AssigneesSettings = ({
  isReadonly,
  value,
  className = 'mb-4',
  onChange,
}) => {
  const [isShowAssigneesEditor, setIsShowAssigneesEditor] = useState(false);

  const assigneesRef = useRef(null);

  const { collaborators, collaboratorsCache, updateCollaboratorsCache, queryUser } = useCollaborators();

  const deleteAssignee = useCallback((event, email) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    const newValue = value.filter(i => i !== email);
    onChange(newValue);
  }, [value, onChange]);

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
          {value.length > 0 ? value.map(assignee => {
            if (!assignee) return null;
            return (
              <AsyncCollaborator
                value={typeof assignee === 'string' ? assignee : assignee.email}
                key={assignee}
                collaborators={collaborators}
                collaboratorsCache={collaboratorsCache}
                updateCollaboratorsCache={updateCollaboratorsCache}
                api={queryUser}
              >
                {!isReadonly && (
                  <Collaborator.RemoveBtn callback={(event) => deleteAssignee(event, assignee)}/>
                )}
              </AsyncCollaborator>
            );
          }) : (<div className="tip-default">{gettext('No one assigned')}</div>)}
        </div>
      </div>
      {!isReadonly && isShowAssigneesEditor && (
        <CollaboratorEditor
          target={assigneesRef}
          value={value}
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
