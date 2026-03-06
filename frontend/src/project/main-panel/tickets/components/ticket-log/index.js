import React, { useCallback, useEffect, useState } from 'react';
import classnames from 'classnames';
import dayjs from '@/utils/dayjs';
import { IconButton } from '@/components';
import { gettext } from '@/constants';
import { useCollaborators } from '@/sea-metadata';
import { PRIORITY_MAP } from '@/sea-metadata/constants/column/priority';
import { useMetadata, useTags } from '@/project/hooks';

import './index.css';

const ACTIVITY_ICONS = {
  title_changed: 'rename',
  state_changed: 'dot-circle-stroked',
  substate_changed: 'dot-circle-stroked',
  state_substate_changed: 'dot-circle-stroked',
  type_changed: 'dot-circle-stroked',
  tags_added: 'tag-stroked',
  tags_removed: 'tag-stroked',
  assignees_added: 'group-stroked',
  assignees_removed: 'group-stroked',
  priority_changed: 'flag-stroked',
};

const TicketLog = ({ log: activity, isSmallScreen = false, className }) => {
  const [creator, setCreator] = useState({});
  const [assigneeNames, setAssigneeNames] = useState({ old: [], new: [] });
  const { getCollaborator, queryUser } = useCollaborators();
  const { statesData, substatesData, typesData } = useMetadata();
  const { tagsData } = useTags();

  useEffect(() => {
    const collaborator = getCollaborator(activity.creator);
    if (collaborator) {
      setCreator(collaborator);
      return;
    }
    queryUser(activity.creator, (userMap) => {
      const user = userMap[activity.creator];
      setCreator(user || { name: activity.creator, avatar_url: '' });
    });
  }, [activity.creator, getCollaborator, queryUser]);

  // Convert tag IDs to names
  const getTagNames = useCallback((tagIds) => {
    if (!tagIds) return '';
    const ids = Array.isArray(tagIds) ? tagIds : [tagIds];
    const names = ids.map(id => {
      const tag = tagsData?.id_row_map?.[String(id)];
      return tag?.name || id;
    });
    return names.join(', ');
  }, [tagsData]);

  const getSingleSelectDisplayValue = useCallback((fieldName, value) => {
    if (value === null || value === undefined || value === '') return value;

    let optionData = null;
    if (fieldName === 'state') optionData = statesData;
    if (fieldName === 'substate') optionData = substatesData;
    if (fieldName === 'type') optionData = typesData;
    if (!optionData) return value;

    const option = optionData?.id_row_map?.[String(value)];
    return option?.name || value;
  }, [statesData, substatesData, typesData]);

  // Convert assignee IDs to names
  useEffect(() => {
    const { activity_type, old_value, new_value } = activity;

    if (activity_type !== 'assignees_added' && activity_type !== 'assignees_removed') {
      return;
    }

    const convertAssignees = async (assigneeIds, isOldValue) => {
      if (!Array.isArray(assigneeIds)) {
        assigneeIds = [assigneeIds];
      }

      const names = [];
      const usersToQuery = [];

      // First try to get from cache
      for (const assigneeId of assigneeIds) {
        const collaborator = getCollaborator(assigneeId);
        if (collaborator) {
          names.push(collaborator.name);
        } else {
          usersToQuery.push(assigneeId);
        }
      }

      // Query users not in cache
      if (usersToQuery.length > 0) {
        queryUser(usersToQuery, (userMap) => {
          const queriedNames = usersToQuery.map(id => {
            const user = userMap[id];
            return user ? user.name : id;
          });

          setAssigneeNames(prev => ({
            ...prev,
            [isOldValue ? 'old' : 'new']: [...names, ...queriedNames]
          }));
        });
      } else {
        setAssigneeNames(prev => ({
          ...prev,
          [isOldValue ? 'old' : 'new']: names
        }));
      }
    };

    if (activity_type === 'assignees_added' && new_value) {
      convertAssignees(new_value, false);
    } else if (activity_type === 'assignees_removed' && old_value) {
      convertAssignees(old_value, true);
    }
  }, [activity, getCollaborator, queryUser]);

  const renderActivityMessage = useCallback(() => {
    const { activity_type, old_value, new_value } = activity;
    const stateOldValue = getSingleSelectDisplayValue('state', old_value);
    const stateNewValue = getSingleSelectDisplayValue('state', new_value);
    const substateOldValue = getSingleSelectDisplayValue('substate', old_value);
    const substateNewValue = getSingleSelectDisplayValue('substate', new_value);
    const typeOldValue = getSingleSelectDisplayValue('type', old_value);
    const typeNewValue = getSingleSelectDisplayValue('type', new_value);
    const oldStateDisplay = getSingleSelectDisplayValue('state', old_value?.state);
    const oldSubstateDisplay = getSingleSelectDisplayValue('substate', old_value?.substate);
    const newStateDisplay = getSingleSelectDisplayValue('state', new_value?.state);
    const newSubstateDisplay = getSingleSelectDisplayValue('substate', new_value?.substate);
    const oldStateWithSubstate = `${oldStateDisplay || gettext('None')} - ${oldSubstateDisplay || gettext('None')}`;
    const newStateWithSubstate = `${newStateDisplay || gettext('None')} - ${newSubstateDisplay || gettext('None')}`;

    switch (activity_type) {
      case 'title_changed':
        return (
          <span>
            {gettext('changed the title from')} <del className="activity-old-value">{old_value}</del> {gettext('to')} <strong className="activity-new-value">{new_value}</strong>
          </span>
        );
      case 'state_changed':
        return (
          <span>
            {gettext('changed the state from')} <del className="activity-old-value">{stateOldValue}</del> {gettext('to')} <strong className="activity-new-value">{stateNewValue}</strong>
          </span>
        );
      case 'substate_changed':
        return (
          <span>
            {gettext('changed the substate from')} <del className="activity-old-value">{substateOldValue || gettext('None')}</del> {gettext('to')} <strong className="activity-new-value">{substateNewValue || gettext('None')}</strong>
          </span>
        );
      case 'state_substate_changed':
        return (
          <span>
            {gettext('changed the state from')} <del className="activity-old-value">{oldStateWithSubstate}</del> {gettext('to')} <strong className="activity-new-value">{newStateWithSubstate}</strong>
          </span>
        );
      case 'type_changed':
        return (
          <span>
            {typeOldValue
              ? <>{gettext('changed the type from')} <del className="activity-old-value">{typeOldValue}</del> {gettext('to')} <strong className="activity-new-value">{typeNewValue || gettext('None')}</strong></>
              : <>{gettext('set the type to')} <strong className="activity-new-value">{typeNewValue}</strong></>
            }
          </span>
        );
      case 'tags_added':
        return (
          <span>
            {gettext('added tags:')} <strong className="activity-new-value">{getTagNames(new_value)}</strong>
          </span>
        );
      case 'tags_removed':
        return (
          <span>
            {gettext('removed tags:')} <del className="activity-old-value">{getTagNames(old_value)}</del>
          </span>
        );
      case 'assignees_added':
        return (
          <span>
            {gettext('assigned')} <strong className="activity-new-value">{assigneeNames.new.length > 0 ? assigneeNames.new.join(', ') : (Array.isArray(new_value) ? new_value.join(', ') : new_value)}</strong>
          </span>
        );
      case 'assignees_removed':
        return (
          <span>
            {gettext('unassigned')} <del className="activity-old-value">{assigneeNames.old.length > 0 ? assigneeNames.old.join(', ') : (Array.isArray(old_value) ? old_value.join(', ') : old_value)}</del>
          </span>
        );
      case 'priority_changed':
        const oldPriority = PRIORITY_MAP[String(old_value || 0)]?.name || old_value || 0;
        const newPriority = PRIORITY_MAP[String(new_value || 0)]?.name || new_value || 0;
        return (
          <span>
            {gettext('changed the priority from')} <del className="activity-old-value">{oldPriority}</del> {gettext('to')} <strong className="activity-new-value">{newPriority}</strong>
          </span>
        );
      default:
        return <span>{gettext('made changes')}</span>;
    }
  }, [activity, assigneeNames, getTagNames, getSingleSelectDisplayValue]);

  const iconSymbol = ACTIVITY_ICONS[activity.activity_type] || 'info';

  return (
    <div className={classnames('sea-ticket-log', className, { 'small': isSmallScreen })}>
      <div className="sea-ticket-log-type-container">
        <IconButton size={{ btn: 24, icon: 14 }} className="sea-ticket-log-btn no-hover-bg" icon={iconSymbol} />
      </div>
      <div className="sea-ticket-log-content">
        {creator.avatar_url && (
          <img className="sea-ticket-log-avatar" src={creator.avatar_url} alt={creator.name} />
        )}
        <span className="sea-ticket-log-creator">{creator.name}</span>
        {renderActivityMessage()}
        <span className="sea-ticket-log-time">{dayjs(activity.created_time).fromNow()}</span>
      </div>
    </div>
  );
};

export default TicketLog;
