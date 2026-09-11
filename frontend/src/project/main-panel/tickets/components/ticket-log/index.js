import React, { useCallback } from 'react';
import classnames from 'classnames';
import { Icon, IconButton, Option, AsyncCollaborator } from '@/components';
import { gettext } from '@/constants';
import { useMetadata, useTags } from '@/project/hooks';
import { CONNECTION_TYPE } from '@/project/main-panel/connections/constants';
import { useCollaborators } from '@/sea-metadata';
import Tag from '@/sea-metadata/components/tag';
import { DELETED_OPTION_BACKGROUND_COLOR, PRIORITY_MAP, DELETED_OPTION } from '@/sea-metadata/constants';
import { getRowById } from '@/sea-metadata/utils/row';
import dayjs from '@/utils/dayjs';
import { TICKET_PREDEFINED_COLUMN_CONFIG, PREDEFINED_TICKET_COLUMN_NAME } from '../../constants';
import AddLog from './add-log';
import LinkedRecord from './linked-record';
import ModifyLog from './modify-log';
import RemoveLog from './remove-log';

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

  GENERAL_TASK_ADDED: 'general_task_added',
  GENERAL_TASK_UPDATED: 'general_task_updated',
  JIRA_ISSUE_ADDED: 'jira_issue_added',
  LINEAR_ISSUE_ADDED: 'linear_issue_added',

  GITHUB_ISSUE_UPDATED: 'github_issue_updated',
  GITHUB_ISSUE_CLOSED: 'github_issue_closed',
  GITHUB_ISSUE_REOPENED: 'github_issue_reopened',
  GITHUB_ISSUE_COMMENT_ADDED: 'github_issue_comment_added',

  DISCOURSE_TOPIC_UPDATED: 'discourse_topic_updated',
  DISCOURSE_TOPIC_COMMENT_ADDED: 'discourse_topic_comment_added',

  DISCORD_THREAD_UPDATED: 'discord_thread_updated',
  DISCORD_THREAD_MESSAGE_ADDED: 'discord_thread_message_added',

  EMAIL_MESSAGE_ADDED: 'email_message_added',
};

const LOG_ICONS = {
  [LOG_TYPE.PRIORITY_CHANGED]: 'flag-stroked',

  [LOG_TYPE.TITLE_CHANGED]: 'rename',

  [LOG_TYPE.STATE_CHANGED]: 'dot-circle-stroked',
  [LOG_TYPE.SUBSTATE_CHANGED]: 'dot-circle-stroked',
  [LOG_TYPE.STATE_SUBSTATE_CHANGED]: 'dot-circle-stroked',

  [LOG_TYPE.TYPE_CHANGED]: 'type-stroked',

  [LOG_TYPE.TAGS_ADDED]: 'tag-stroked',
  [LOG_TYPE.TAGS_REMOVED]: 'tag-stroked',
  [LOG_TYPE.TAGS_CHANGED]: 'tag-stroked',

  [LOG_TYPE.ASSIGNEES_ADDED]: 'user-stroked',
  [LOG_TYPE.ASSIGNEES_REMOVED]: 'user-stroked',
  [LOG_TYPE.ASSIGNEES_CHANGED]: 'user-stroked',

  [LOG_TYPE.GENERAL_TASK_ADDED]: 'task-filled',
  [LOG_TYPE.GENERAL_TASK_UPDATED]: 'task-filled',
  [LOG_TYPE.JIRA_ISSUE_ADDED]: 'task-filled',
  [LOG_TYPE.LINEAR_ISSUE_ADDED]: 'task-filled',

  [LOG_TYPE.GITHUB_ISSUE_UPDATED]: 'github-filled',
  [LOG_TYPE.GITHUB_ISSUE_CLOSED]: 'github-filled',
  [LOG_TYPE.GITHUB_ISSUE_REOPENED]: 'github-filled',
  [LOG_TYPE.GITHUB_ISSUE_COMMENT_ADDED]: 'github-filled',

  [LOG_TYPE.DISCOURSE_TOPIC_UPDATED]: 'discourse-filled',
  [LOG_TYPE.DISCOURSE_TOPIC_COMMENT_ADDED]: 'discourse-filled',

  [LOG_TYPE.DISCORD_THREAD_UPDATED]: 'discord-filled',
  [LOG_TYPE.DISCORD_THREAD_MESSAGE_ADDED]: 'discord-filled',

  [LOG_TYPE.EMAIL_MESSAGE_ADDED]: 'email-filled',
};

const diff = (newValue, oldValue) => {
  const removed = oldValue.filter(item => !newValue.includes(item));
  const added = newValue.filter(item => !oldValue.includes(item));
  return { removed, added };
};

export const getTicketLogAnchorId = (activityId) => `ticket-log-${activityId}`;

const TicketLog = ({ log: activity, projectUuid, isSmallScreen = false, className, permission }) => {
  const { collaborators, collaboratorsCache, updateCollaboratorsCache, queryUser } = useCollaborators();
  const { statesData, substatesData, typesData } = useMetadata();
  const { tagsData } = useTags();

  const renderGithubIssueRef = useCallback((activity = {}) => {
    const { connection_id, issue_number, issue_url, title = '' } = activity;
    if (!issue_number) return null;
    if (issue_url) {
      return (
        <LinkedRecord
          record={{ type: CONNECTION_TYPE.GITHUB_ISSUE, title, _id: issue_number, connection_id }}
          projectUuid={projectUuid}
          permission={permission}
          type={CONNECTION_TYPE.GITHUB_ISSUE}
        >
          <>{title || '# ' + issue_number}</>
        </LinkedRecord>
      );
    }
    return <span>{title || '# ' + issue_number}</span>;
  }, [projectUuid, permission]);

  const renderDiscourseTopicRef = useCallback((activity = {}) => {
    const { connection_id, topic_id, topic_url, title = '' } = activity;
    if (!topic_id) return null;
    if (topic_url) {
      return (
        <LinkedRecord
          record={{ type: CONNECTION_TYPE.DISCOURSE_FORUM, title, _id: topic_id, connection_id }}
          projectUuid={projectUuid}
          permission={permission}
          type={CONNECTION_TYPE.DISCOURSE_FORUM}
        >
          <>{title || '# ' + topic_id}</>
        </LinkedRecord>
      );
    }
    return <span>{title || '# ' + topic_id}</span>;
  }, [projectUuid, permission]);

  const renderDiscordThreadRef = useCallback(({ connection_id, record_id, thread_id, title = '', thread_url } = {}) => {
    if (!thread_id) return null;
    if (thread_url && record_id) {
      return (
        <LinkedRecord
          record={{ type: CONNECTION_TYPE.DISCORD, title, _id: record_id, connection_id }}
          projectUuid={projectUuid}
          permission={permission}
          type={CONNECTION_TYPE.DISCORD}
        >
          <>{title || '# ' + thread_id}</>
        </LinkedRecord>
      );
    }
    return <span>{title || '# ' + thread_id}</span>;
  }, [projectUuid, permission]);

  const renderEmailThreadRef = useCallback(({ connection_id, thread_id, title = '' } = {}) => {
    if (!thread_id) return title ? <span>{title}</span> : null;
    const label = title || `#${thread_id}`;
    if (projectUuid && connection_id) {
      return (
        <LinkedRecord
          permission={permission}
          record={{ type: CONNECTION_TYPE.EMAIL, title, _id: thread_id, connection_id }}
          projectUuid={projectUuid}
          type={CONNECTION_TYPE.EMAIL}
        >
          {label}
        </LinkedRecord>
      );
    }
    if (title) {
      return <span>{title}</span>;
    }
    if (thread_id) {
      return <span>{label}</span>;
    }
    return null;
  }, [projectUuid, permission]);

  const renderTaskRef = useCallback(({ connection_id, connection_type, record_id, title = '' } = {}) => {
    const taskId = record_id;
    if (!taskId) return title ? <span>{title}</span> : null;
    const label = title || `#${taskId}`;
    if (projectUuid && connection_id) {
      return (
        <LinkedRecord
          record={{ type: connection_type || CONNECTION_TYPE.GENERAL_TASK, title, _id: taskId, connection_id }}
          projectUuid={projectUuid}
          permission={permission}
          type={connection_type || CONNECTION_TYPE.GENERAL_TASK}
        >
          {label}
        </LinkedRecord>
      );
    }
    return <span>{label}</span>;
  }, [permission, projectUuid]);

  const renderActivityMessage = useCallback(() => {
    const { activity_type, old_value, new_value, thread_id } = activity;
    const asyncCollaboratorProps = {
      className: 'mr-0',
      collaborators,
      collaboratorsCache,
      updateCollaboratorsCache,
      api: queryUser,
    };

    const githubLabelMap = {
      title: gettext('title'),
      state: gettext('state'),
      labels: gettext('labels'),
      assignees: gettext('assignees'),
      issue_type: gettext('type'),
      state_reason: gettext('reason'),
    };
    const discourseLabelMap = {
      title: gettext('title'),
      category_id: gettext('category'),
      resolved: gettext('resolved'),
    };
    const discordLabelMap = {
      title: gettext('title'),
    };
    const generalTaskLabelMap = {
      title: gettext('title'),
      status: gettext('status'),
      size: gettext('size'),
      priority: gettext('priority'),
      assignees: gettext('assignees'),
      participants: gettext('participants'),
      version: gettext('version'),
      others: gettext('others'),
      content: gettext('content'),
      description: gettext('description'),
      due_date: gettext('due date'),
    };
    const isEmptyValue = (val) => {
      if (val === null || val === undefined) return true;
      if (Array.isArray(val)) return val.length === 0;
      return String(val) === '';
    };
    const formatDateValue = (val) => {
      const dateValue = String(val || '').trim();
      if (!dateValue) return null;
      const date = dayjs(dateValue);
      if (date.isValid()) {
        return date.format('YYYY-MM-DD');
      }
      return dateValue;
    };
    const renderTaskUserList = (emails, userMap, removed = false) => {
      if (!Array.isArray(emails) || emails.length === 0) return null;
      return (
        <>
          {emails.map((email, index) => (
            <React.Fragment key={email}>
              {index > 0 ? ', ' : ''}
              <span className={removed ? 'seaqa-log-removed' : ''} title={email}>
                {userMap[email] || email}
              </span>
            </React.Fragment>
          ))}
        </>
      );
    };
    const renderValueNode = (field, val, removed = false, taskUserMap = null) => {
      if (isEmptyValue(val)) return null;
      if (field === 'due_date') {
        const dateValue = formatDateValue(val);
        return (
          <span className="seaqa-log-date">
            <Icon symbol="time" className="seaqa-log-date-icon" />
            <span className="seaqa-log-date-text" title={dateValue}>
              {dateValue}
            </span>
          </span>
        );
      }
      if (taskUserMap && (field === 'assignees' || field === 'participants')) {
        return renderTaskUserList(val, taskUserMap, removed);
      }
      if (Array.isArray(val)) return val.join(', ');
      if (typeof val === 'boolean') return val ? gettext('yes') : gettext('no');
      if (typeof val === 'object') return JSON.stringify(val);

      const stringValue = String(val) || null;
      return (removed && stringValue) ? (<span className="seaqa-log-text-removed">{stringValue}</span>) : stringValue;
    };
    const renderStatusOption = (value, removed) => (
      <Option
        option={{ name: value, color: '#9c9c9e', text_color: 'var(--bs-body-bg)' }}
        className={removed ? 'seaqa-log-removed' : ''}
      />
    );
    const renderChangeNodes = (oldVal, newVal, labelMap, taskUserMap = null) => {
      const oldObj = (oldVal && typeof oldVal === 'object') ? oldVal : {};
      const newObj = (newVal && typeof newVal === 'object') ? newVal : {};
      const allFields = [...new Set([...Object.keys(newObj), ...Object.keys(oldObj)])];
      return allFields.map(field => {
        const label = labelMap[field] || field;
        const oldValue = field === 'status' && oldObj[field]?.status !== undefined ? oldObj[field].status : oldObj[field];
        const newValue = field === 'status' && newObj[field]?.status !== undefined ? newObj[field].status : newObj[field];
        const hasOld = !isEmptyValue(oldValue);
        const hasNew = !isEmptyValue(newValue);
        const o = field === 'status' && hasOld ? renderStatusOption(oldValue, true) : renderValueNode(field, oldValue, true, taskUserMap);
        const n = field === 'status' && hasNew ? renderStatusOption(newValue, false) : renderValueNode(field, newValue, false, taskUserMap);
        if (!hasOld && hasNew) return <span key={field}>{' '}{label} {gettext('added')}: <span>{n}</span></span>;
        if (hasOld && !hasNew) return <span key={field}>{' '}{label} {gettext('removed')}: <span className="seaqa-log-removed">{o}</span></span>;
        if (hasOld && hasNew) return <span key={field}>{' '}{label} {gettext('changed from')} <span className="seaqa-log-removed">{o}</span> {gettext('to')} <span>{n}</span></span>;
        return null;
      }).filter(Boolean);
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
                option={{ name: oldValueOption.name, color: oldValueOption.icon_color || DELETED_OPTION_BACKGROUND_COLOR, text_color: oldValueOption.icon_color ? '#fff' : 'var(--bs-body-color)' }}
                className="seaqa-log-removed"
              />
            ),
            newValue: (
              <Option option={{ name: newValueOption.name, color: newValueOption.icon_color || DELETED_OPTION_BACKGROUND_COLOR, text_color: newValueOption.icon_color ? '#fff' : 'var(--bs-body-color)' }} />
            ),
          }
        ];
        return (<ModifyLog modifies={modifies} />);
      }
      case LOG_TYPE.TITLE_CHANGED: {
        const modifies = [
          {
            name: TICKET_PREDEFINED_COLUMN_CONFIG[PREDEFINED_TICKET_COLUMN_NAME.TITLE].op_name,
            oldValue: (<del className="seaqa-log-removed">{old_value}</del>),
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
            oldValue: (<Option option={oldValueOption} className="seaqa-log-removed" />),
            newValue: (<Option option={newValueOption} />),
          }
        ];

        return (<ModifyLog modifies={modifies}/>);
      }
      case LOG_TYPE.SUBSTATE_CHANGED: {
        const oldValueOption = getRowById(substatesData, old_value + '') || DELETED_OPTION;
        const newValueOption = getRowById(substatesData, new_value + '') || DELETED_OPTION;
        if (!old_value) {
          return (<AddLog name={gettext('added the substate')} value={(<Option option={newValueOption} />)}/>);
        }

        if (!new_value) {
          return (<RemoveLog name={gettext('removed the substate')} value={(<Option option={oldValueOption} />)}/>);
        }

        const modifies = [
          {
            name: TICKET_PREDEFINED_COLUMN_CONFIG[PREDEFINED_TICKET_COLUMN_NAME.SUB_STATE].op_name,
            oldValue: (<Option option={oldValueOption} className="seaqa-log-removed" />),
            newValue: (<Option option={newValueOption} />),
          }
        ];

        return (<ModifyLog modifies={modifies}/>);

      }
      case LOG_TYPE.TYPE_CHANGED: {
        const oldValueOption = getRowById(typesData, old_value + '') || DELETED_OPTION;
        const newValueOption = getRowById(typesData, new_value + '') || DELETED_OPTION;

        if (!old_value) {
          return (<AddLog name={gettext('added the type')} value={(<Option option={newValueOption} />)}/>);
        }

        if (!new_value) {
          return (<RemoveLog name={gettext('removed the type')} value={(<Option option={oldValueOption} />)}/>);
        }

        const modifies = [
          {
            name: TICKET_PREDEFINED_COLUMN_CONFIG[PREDEFINED_TICKET_COLUMN_NAME.TYPE].op_name,
            oldValue: (<Option option={oldValueOption} className="seaqa-log-removed" />),
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

        const stateOldValueOption = getRowById(statesData, stateOldValue + '') || DELETED_OPTION;
        const stateNewValueOption = getRowById(statesData, stateNewValue + '') || DELETED_OPTION;
        const substateOldValueOption = getRowById(substatesData, substateOldValue + '') || DELETED_OPTION;
        const substateNewValueOption = getRowById(substatesData, substateNewValue + '') || DELETED_OPTION;
        const modifies = [
          {
            name: TICKET_PREDEFINED_COLUMN_CONFIG[PREDEFINED_TICKET_COLUMN_NAME.STATE].op_name,
            oldValue: (<Option option={stateOldValueOption} className="seaqa-log-removed" />),
            newValue: (<Option option={stateNewValueOption} />),
          }, {
            name: TICKET_PREDEFINED_COLUMN_CONFIG[PREDEFINED_TICKET_COLUMN_NAME.SUB_STATE].op_name,
            oldValue: (<Option option={substateOldValueOption} className="seaqa-log-removed" />),
            newValue: (<Option option={substateNewValueOption} />),
          }
        ];

        if (stateOldValue && stateNewValue && substateOldValue && substateNewValue) {
          return (<ModifyLog modifies={modifies} />);
        }

        let stateLog = (<ModifyLog modifies={[modifies[0]]} />);
        if (!stateOldValue && stateNewValue) {
          stateLog = (<AddLog name={gettext('added state')} value={<Option option={stateNewValueOption} />} />);
        } else if (stateOldValue && !stateNewValue) {
          stateLog = (<RemoveLog name={gettext('Removed state')} value={(<Option option={stateOldValueOption} />)} />);
        }

        let substateLog = (<ModifyLog modifies={[modifies[1]]} />);
        if (!substateOldValue && substateNewValue) {
          substateLog = (<AddLog name={gettext('added substate')} value={<Option option={substateNewValueOption} />} />);
        } else if (substateOldValue && !substateNewValue) {
          substateLog = (<RemoveLog name={gettext('Removed substate')} value={(<Option option={substateOldValueOption} />)} />);
        }

        return (
          <>
            {stateLog}
            {' '}
            {gettext('and')}
            {' '}
            {substateLog}
          </>
        );
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
                {old_value.map(email => (<AsyncCollaborator key={email} value={email} { ...asyncCollaboratorProps } className="mr-0 seaqa-log-removed"/>))}
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
                    {removed.map(email => (<AsyncCollaborator key={email} value={email} { ...asyncCollaboratorProps } className="mr-0 seaqa-log-removed"/>))}
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
                  return (<Tag tag={tag} key={tagID} className="mr-0 seaqa-log-removed" />);
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
                    {removedTags.map(tag => (<Tag tag={tag} key={tag._id} className="mr-0 seaqa-log-removed" />))}
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

      // linked info
      case LOG_TYPE.GENERAL_TASK_ADDED:
      case LOG_TYPE.JIRA_ISSUE_ADDED:
      case LOG_TYPE.LINEAR_ISSUE_ADDED: {
        const ref = renderTaskRef(activity);
        return (
          <span>{gettext('Task')}{ref ? <>{' '}{ref}</> : null}{' '}{gettext('added')}</span>
        );
      }
      case LOG_TYPE.GENERAL_TASK_UPDATED: {
        const ref = renderTaskRef(activity);
        const taskUserMap = (activity.related_users || []).reduce((map, user) => {
          if (user?.email && user?.name) {
            map[user.email] = user.name;
          }
          return map;
        }, {});
        const changeNodes = renderChangeNodes(old_value, new_value, generalTaskLabelMap, taskUserMap);
        if (changeNodes.length === 0) {
          return <span>{gettext('updated general task')}{ref ? <>{' '}{ref}</> : null}</span>;
        }
        return (
          <>
            {gettext('Task')}{ref ? <>{' '}{ref}</> : null}
            {changeNodes}
          </>
        );
      }

      // GitHub issue
      case LOG_TYPE.GITHUB_ISSUE_CLOSED: {
        const ref = renderGithubIssueRef(activity);
        return <span>{gettext('GitHub issue')}{ref ? <>{' '}{ref}</> : null}{' '}{gettext('closed')}</span>;
      }
      case LOG_TYPE.GITHUB_ISSUE_REOPENED: {
        const ref = renderGithubIssueRef(activity);
        return <span>{gettext('GitHub issue')}{ref ? <>{' '}{ref}</> : null}{' '}{gettext('reopened')}</span>;
      }
      case LOG_TYPE.GITHUB_ISSUE_UPDATED: {
        const ref = renderGithubIssueRef(activity);
        const changeNodes = renderChangeNodes(old_value, new_value, githubLabelMap);
        if (changeNodes.length === 0) {
          return <span>{gettext('updated GitHub issue')}{ref ? <>{' '}{ref}</> : null}</span>;
        }
        return (
          <>
            {gettext('GitHub issue')}{ref ? <>{' '}{ref}</> : null}
            {changeNodes}
          </>
        );
      }
      case LOG_TYPE.GITHUB_ISSUE_COMMENT_ADDED: {
        const ref = renderGithubIssueRef(activity);
        const isLegacyNumber = typeof new_value === 'number';
        const isObjectValue = !isLegacyNumber && new_value && typeof new_value === 'object';
        const count = isLegacyNumber ? new_value : (isObjectValue ? (new_value.count || 1) : 1);
        const author = isObjectValue ? new_value.author : '';
        return (
          <span>
            {gettext('GitHub issue')}{ref ? <>{' '}{ref}</> : null}{' '}
            {count}{' '}{count === 1 ? gettext('comment') : gettext('comments')}{' '}
            {gettext('added')}
            {author ? <>{' '}{gettext('by')}{' '}<span>{author}</span></> : null}
          </span>
        );
      }

      case LOG_TYPE.DISCOURSE_TOPIC_UPDATED: {
        const ref = renderDiscourseTopicRef(activity);
        const changeNodes = renderChangeNodes(old_value, new_value, discourseLabelMap);
        if (changeNodes.length === 0) {
          return <span>{gettext('updated Discourse topic')}{ref ? <>{' '}{ref}</> : null}</span>;
        }
        return (
          <>
            {gettext('Discourse topic')}{ref ? <>{' '}{ref}</> : null}
            {changeNodes}
          </>
        );
      }
      case LOG_TYPE.DISCOURSE_TOPIC_COMMENT_ADDED: {
        const ref = renderDiscourseTopicRef(activity);
        const isLegacyNumber = typeof new_value === 'number';
        const isObjectValue = !isLegacyNumber && new_value && typeof new_value === 'object';
        const count = isLegacyNumber ? new_value : (isObjectValue ? (new_value.count || 1) : 1);
        const author = isObjectValue ? new_value.author : '';
        return (
          <span>
            {gettext('Discourse topic')}{ref ? <>{' '}{ref}</> : null}{' '}
            {count}{' '}{count === 1 ? gettext('reply') : gettext('replies')}{' '}
            {gettext('added')}
            {author ? <>{' '}{gettext('by')}{' '}<span>{author}</span></> : null}
          </span>
        );
      }
      case LOG_TYPE.DISCORD_THREAD_UPDATED: {
        const ref = renderDiscordThreadRef(activity);
        const changeNodes = renderChangeNodes(old_value, new_value, discordLabelMap);
        if (changeNodes.length === 0) {
          return <span>{gettext('updated Discord thread')}{ref ? <>{' '}{ref}</> : null}</span>;
        }
        return (
          <>
            {gettext('Discord thread')}{ref ? <>{' '}{ref}</> : null}
            {changeNodes}
          </>
        );
      }
      case LOG_TYPE.DISCORD_THREAD_MESSAGE_ADDED: {
        const ref = renderDiscordThreadRef(activity);
        const isLegacyNumber = typeof new_value === 'number';
        const isObjectValue = !isLegacyNumber && new_value && typeof new_value === 'object';
        const count = isLegacyNumber ? new_value : (isObjectValue ? (new_value.count || 1) : 1);
        const author = isObjectValue ? new_value.author : '';
        return (
          <span>
            {gettext('Discord thread')}{ref ? <>{' '}{ref}</> : null}{' '}
            {count}{' '}{count === 1 ? gettext('message') : gettext('messages')}{' '}
            {gettext('added')}
            {author ? <>{' '}{gettext('by')}{' '}<span>{author}</span></> : null}
          </span>
        );
      }
      case LOG_TYPE.EMAIL_MESSAGE_ADDED: {
        const count = typeof new_value === 'number' ? new_value : 1;
        return (
          <span>
            {gettext('Email thread')}
            {thread_id && <>{' '}{renderEmailThreadRef(activity)}</>}
            {' '}{count}{' '}{count === 1 ? gettext('message') : gettext('messages')}{' '}{gettext('added')}
          </span>
        );
      }
      default:
        return <span>{gettext('made changes')}</span>;
    }
  }, [
    activity, collaborators, collaboratorsCache, queryUser, statesData, tagsData, substatesData, typesData, updateCollaboratorsCache,
    renderTaskRef, renderDiscordThreadRef, renderDiscourseTopicRef, renderEmailThreadRef, renderGithubIssueRef,
  ]);

  const iconSymbol = LOG_ICONS[activity.activity_type] || 'info';

  return (
    <>
      <div
        id={getTicketLogAnchorId(activity.id)}
        className={classnames('seaqa-log', className, { 's': isSmallScreen })}
      >
        <div className="seaqa-log-type-container">
          <IconButton size={{ btn: 24, icon: 14 }} className="seaqa-log-btn no-hover-bg" icon={iconSymbol} />
        </div>
        <div className="seaqa-log-content">
          {activity.activity_type && !activity.activity_type.startsWith('github_issue_') && !activity.activity_type.startsWith('discourse_topic_') && !activity.activity_type.startsWith('discord_thread_') && !activity.activity_type.startsWith('email_') && !activity.activity_type.startsWith('general_task_') && (
            <AsyncCollaborator
              value={activity.creator}
              className="seaqa-log-creator"
              collaborators={collaborators}
              collaboratorsCache={collaboratorsCache}
              updateCollaboratorsCache={updateCollaboratorsCache}
              api={queryUser}
            />
          )}
          {renderActivityMessage()}
          <span className="seaqa-log-time">{dayjs(activity.created_time).fromNow()}</span>
        </div>
      </div>
    </>
  );
};

export default TicketLog;
