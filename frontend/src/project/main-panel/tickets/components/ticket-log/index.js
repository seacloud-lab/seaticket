import React, { useCallback } from 'react';
import classnames from 'classnames';
import dayjs from '@/utils/dayjs';
import { IconButton, Option, AsyncCollaborator } from '@/components';
import { gettext } from '@/constants';
import { useCollaborators } from '@/sea-metadata';
import { DELETED_OPTION_BACKGROUND_COLOR, PRIORITY_MAP } from '@/sea-metadata/constants';
import { useMetadata, useTags } from '@/project/hooks';
import ModifyLog from './modify-log';
import AddLog from './add-log';
import RemoveLog from './remove-log';
import Tag from '@/sea-metadata/components/tag';
import { TICKET_PREDEFINED_COLUMN_CONFIG, PREDEFINED_TICKET_COLUMN_NAME } from '../../constants';
import { getRowById } from '@/sea-metadata/utils/row';

import './index.css';

const LOG_TYPE = {
  PRIORITY_CHANGED: 'priority_changed',
  TITLE_CHANGED: 'title_changed',
  STATE_CHANGED: 'state_changed',
  SUBSTATE_CHANGED: 'substate_changed',
  STATE_SUBSTATE_CHANGED: 'state_substate_changed',
  TYPE_CHANGED: 'type_changed',

  TAGS_ADDED: 'tags_added',
  TAGS_REMOVED: 'tags_removed',
  TAGS_CHANGED: 'tags_changed',

  ASSIGNEES_ADDED: 'assignees_added',
  ASSIGNEES_REMOVED: 'assignees_removed',
  ASSIGNEES_CHANGED: 'assignees_changed',
};

const LOG_ICONS = {
  [LOG_TYPE.PRIORITY_CHANGED]: 'flag-stroked',
  [LOG_TYPE.TITLE_CHANGED]: 'rename',
  [LOG_TYPE.STATE_CHANGED]: 'dot-circle-stroked',
  [LOG_TYPE.SUBSTATE_CHANGED]: 'dot-circle-stroked',
  [LOG_TYPE.STATE_SUBSTATE_CHANGED]: 'dot-circle-stroked',
  [LOG_TYPE.TYPE_CHANGED]: 'dot-circle-stroked',

  [LOG_TYPE.TAGS_ADDED]: 'tag-stroked',
  [LOG_TYPE.TAGS_REMOVED]: 'tag-stroked',
  [LOG_TYPE.TAGS_CHANGED]: 'tag-stroked',

  [LOG_TYPE.ASSIGNEES_ADDED]: 'group-stroked',
  [LOG_TYPE.ASSIGNEES_REMOVED]: 'group-stroked',
  [LOG_TYPE.ASSIGNEES_CHANGED]: 'group-stroked',
};

const diff = (newValue, oldValue) => {
  const removed = oldValue.filter(item => !newValue.includes(item));
  const added = newValue.filter(item => !oldValue.includes(item));
  return { removed, added };
};

const TicketLog = ({ log: activity, isSmallScreen = false, className }) => {
  const { collaborators, collaboratorsCache, updateCollaboratorsCache, queryUser } = useCollaborators();
  const { statesData, substatesData, typesData } = useMetadata();
  const { tagsData } = useTags();

  const renderActivityMessage = useCallback(() => {
    const { activity_type, old_value, new_value } = activity;
    const asyncCollaboratorProps = {
      className: 'mr-0',
      collaborators,
      collaboratorsCache,
      updateCollaboratorsCache,
      api: queryUser,
    };

    switch (activity_type) {
      case LOG_TYPE.PRIORITY_CHANGED: {
        const oldValueOption = PRIORITY_MAP[old_value + ''] || PRIORITY_MAP['0'];
        const newValueOption = PRIORITY_MAP[new_value + ''] || PRIORITY_MAP['0'];
        const modifies = [
          {
            name: TICKET_PREDEFINED_COLUMN_CONFIG[PREDEFINED_TICKET_COLUMN_NAME.PRIORITY].op_name,
            oldValue: (
              <Option
                option={{ name: oldValueOption.name, color: oldValueOption.icon_color || DELETED_OPTION_BACKGROUND_COLOR, text_color: oldValueOption.icon_color ? '#fff' : '#212529' }}
                className="sea-ticket-log-removed"
              />
            ),
            newValue: (
              <Option option={{ name: newValueOption.name, color: newValueOption.icon_color || DELETED_OPTION_BACKGROUND_COLOR, text_color: newValueOption.icon_color ? '#fff' : '#212529' }} />
            ),
          }
        ];
        return (<ModifyLog modifies={modifies} />);
      }
      case LOG_TYPE.TITLE_CHANGED: {
        const modifies = [
          {
            name: TICKET_PREDEFINED_COLUMN_CONFIG[PREDEFINED_TICKET_COLUMN_NAME.TITLE].op_name,
            oldValue: (<del className="sea-ticket-log-removed">{old_value}</del>),
            newValue: new_value,
          }
        ];
        return (<ModifyLog modifies={modifies} />);
      }
      case LOG_TYPE.STATE_CHANGED: {
        const oldValueOption = getRowById(statesData, old_value + '');
        const newValueOption = getRowById(statesData, new_value + '');
        const modifies = [
          {
            name: TICKET_PREDEFINED_COLUMN_CONFIG[PREDEFINED_TICKET_COLUMN_NAME.STATE].op_name,
            oldValue: (<Option option={oldValueOption} className="sea-ticket-log-removed" />),
            newValue: (<Option option={newValueOption} />),
          }
        ];

        return (<ModifyLog modifies={modifies}/>);
      }
      case LOG_TYPE.SUBSTATE_CHANGED: {
        const oldValueOption = getRowById(substatesData, old_value + '');
        const newValueOption = getRowById(substatesData, new_value + '');
        const modifies = [
          {
            name: TICKET_PREDEFINED_COLUMN_CONFIG[PREDEFINED_TICKET_COLUMN_NAME.SUB_STATE].op_name,
            oldValue: (<Option option={oldValueOption} className="sea-ticket-log-removed" />),
            newValue: (<Option option={newValueOption} />),
          }
        ];

        return (<ModifyLog modifies={modifies}/>);
      }
      case LOG_TYPE.TYPE_CHANGED: {
        const oldValueOption = getRowById(typesData, old_value + '');
        const newValueOption = getRowById(typesData, new_value + '');

        if (!old_value) {
          return (<AddLog name={gettext('added the type')} value={(<Option option={newValueOption} />)}/>);
        }

        const modifies = [
          {
            name: TICKET_PREDEFINED_COLUMN_CONFIG[PREDEFINED_TICKET_COLUMN_NAME.PRIORITY].op_name,
            oldValue: (<Option option={oldValueOption} className="sea-ticket-log-removed" />),
            newValue: (<Option option={newValueOption} />),
          }
        ];

        return (<ModifyLog modifies={modifies} />);
      }
      case LOG_TYPE.STATE_SUBSTATE_CHANGED: {
        const { field_key } = activity;
        const [state_key, substate_key] = field_key.split('_');
        const stateOldValue = old_value[state_key];
        const stateNewValue = new_value[state_key];
        const substateOldValue = old_value[substate_key];
        const substateNewValue = new_value[substate_key];

        const stateOldValueOption = getRowById(statesData, stateOldValue + '');
        const stateNewValueOption = getRowById(statesData, stateNewValue + '');
        const substateOldValueOption = getRowById(substatesData, substateOldValue + '');
        const substateNewValueOption = getRowById(substatesData, substateNewValue + '');

        const modifies = [
          {
            name: TICKET_PREDEFINED_COLUMN_CONFIG[PREDEFINED_TICKET_COLUMN_NAME.STATE].op_name,
            oldValue: (<Option option={stateOldValueOption} className="sea-ticket-log-removed" />),
            newValue: (<Option option={stateNewValueOption} />),
          }, {
            name: TICKET_PREDEFINED_COLUMN_CONFIG[PREDEFINED_TICKET_COLUMN_NAME.SUB_STATE].op_name,
            oldValue: (<Option option={substateOldValueOption} className="sea-ticket-log-removed" />),
            newValue: (<Option option={substateNewValueOption} />),
          }
        ];

        return (<ModifyLog modifies={modifies} />);
      }

      // assignees
      case LOG_TYPE.ASSIGNEES_ADDED: {
        if (!Array.isArray(new_value)) return null;
        return (
          <AddLog
            name={gettext('assigned')}
            value={(
              <>
                {new_value.map(email => (<AsyncCollaborator key={email} value={email} { ...asyncCollaboratorProps } />))}
              </>
            )}
          />
        );
      }
      case LOG_TYPE.ASSIGNEES_REMOVED: {
        return (
          <RemoveLog
            name={gettext('unassigned')}
            value={(
              <>
                {old_value.map(email => (<AsyncCollaborator key={email} value={email} { ...asyncCollaboratorProps } className="mr-0 sea-ticket-log-removed"/>))}
              </>
            )}
          />
        );
      }
      case LOG_TYPE.ASSIGNEES_CHANGED: {
        const { added, removed } = diff(new_value || [], old_value || []);
        return (
          <>
            {removed.length > 0 && (
              <RemoveLog
                name={gettext('unassigned')}
                value={(
                  <>
                    {removed.map(email => (<AsyncCollaborator key={email} value={email} { ...asyncCollaboratorProps } className="mr-0 sea-ticket-log-removed"/>))}
                  </>
                )}
              />
            )}
            {added.length > 0 && removed.length > 0 && (<>{gettext('and')}{' '}</>)}
            {added.length > 0 && (
              <AddLog
                name={gettext('assigned')}
                value={(
                  <>
                    {added.map(email => (<AsyncCollaborator key={email} value={email} { ...asyncCollaboratorProps } />))}
                  </>
                )}
              />
            )}
          </>
        );
      }

      // tags
      case LOG_TYPE.TAGS_ADDED: {
        if (!Array.isArray(new_value)) return null;
        return (
          <AddLog
            name={gettext('added tags')}
            value={(
              <>
                {new_value.map(tagID => {
                  const tag = getRowById(tagsData, tagID + '');
                  if (!tagID) return null;
                  return (<Tag tag={tag} key={tagID} className="mr-0" />);
                })}
              </>
            )}
          />
        );
      }
      case LOG_TYPE.TAGS_REMOVED: {
        if (!Array.isArray(new_value)) return null;
        return (
          <RemoveLog
            name={gettext('removed tags')}
            value={(
              <>
                {new_value.map(tagID => {
                  const tag = getRowById(tagsData, tagID + '');
                  if (!tagID) return null;
                  return (<Tag tag={tag} key={tagID} className="mr-0 sea-ticket-log-removed" />);
                })}
              </>
            )}
          />
        );
      }
      case LOG_TYPE.TAGS_CHANGED: {
        const { added, removed } = diff(new_value || [], old_value || []);
        const addedTags = added.map(t => getRowById(tagsData, t + '')).filter(Boolean);
        const removedTags = removed.map(t => getRowById(tagsData, t + '')).filter(Boolean);
        return (
          <>
            {removedTags.length > 0 && (
              <RemoveLog
                name={gettext('removed tags')}
                value={(
                  <>
                    {removedTags.map(tag => (<Tag tag={tag} key={tag._id} className="mr-0 sea-ticket-log-removed" />))}
                  </>
                )}
              />
            )}
            {addedTags.length > 0 && removed.length > 0 && (<>{gettext('and')}{' '}</>)}
            {addedTags.length > 0 && (
              <AddLog
                name={gettext('added tags')}
                value={(
                  <>
                    {addedTags.map(tag => (<Tag tag={tag} key={tag._id} className="mr-0" />))}
                  </>
                )}
              />
            )}
          </>
        );
      }
      default:
        return <span>{gettext('made changes')}</span>;
    }
  }, [activity]);

  const iconSymbol = LOG_ICONS[activity.activity_type] || 'info';

  return (
    <div className={classnames('sea-ticket-log', className, { 'small': isSmallScreen })}>
      <div className="sea-ticket-log-type-container">
        <IconButton size={{ btn: 24, icon: 14 }} className="sea-ticket-log-btn no-hover-bg" icon={iconSymbol} />
      </div>
      <div className="sea-ticket-log-content">
        <AsyncCollaborator
          value={activity.creator}
          className="sea-ticket-log-creator"
          collaborators={collaborators}
          collaboratorsCache={collaboratorsCache}
          updateCollaboratorsCache={updateCollaboratorsCache}
          api={queryUser}
        />
        {renderActivityMessage()}
        <span className="sea-ticket-log-time">{dayjs(activity.created_time).fromNow()}</span>
      </div>
    </div>
  );
};

export default TicketLog;
