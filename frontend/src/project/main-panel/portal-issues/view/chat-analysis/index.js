import React, { useMemo } from 'react';
import { gettext, PERMISSION_TYPES } from '@/constants';
import SeaMetadata, { CellType, VIEW_TOOL, EVENT_BUS_TYPE } from '@/sea-metadata';
import { chatAPI } from '@/portal/api/chat-api';
import context from '@/sea-metadata/context';
import { VIEW_TYPE, STATISTIC_TYPE } from '@/sea-metadata/constants';
import SidePanelChat from '@/project/main-panel/ask/side-panel-chat';
import { useData } from '@/project/hooks';
import { PORTAL_CHAT_TABLE_NAME } from '../../constants';

const viewTools = [
  VIEW_TOOL.ROWS_TOOLS, VIEW_TOOL.VIEWS,
  VIEW_TOOL.SEARCH, VIEW_TOOL.SORTS,
];

const settings = {
  canClearCells: false,
  canPasteCells: false,
  canDragFillCells: false,
  isFilterComputedOnServer: true,
  isSortComputedOnServer: true,
  canManageView: false,
};

const formatTokenCount = (count) => Number(count) || 0;

const formatCreditCount = (count) => {
  const value = Number(count) || 0;
  return value.toFixed(8).replace(/\.?(0+)$/, '');
};

const formatComparison = (changePercent) => {
  if (changePercent === null || changePercent === undefined || Number.isNaN(Number(changePercent))) {
    return { value: '--', status: 'neutral' };
  }

  const value = Number(changePercent);
  if (value > 0) {
    return { value: `↑ ${value.toFixed(2)}%`, status: 'increase' };
  }
  if (value < 0) {
    return { value: `↓ ${Math.abs(value).toFixed(2)}%`, status: 'decrease' };
  }
  return { value: '0%', status: 'neutral' };
};

const ChatAnalysis = ({
  projectUuid,
  projectName,
  workspaceID,
  isAdmin: isProjectAdmin,
}) => {
  const { getMetadata } = useData();

  const viewsData = useMemo(() => ({
    navigation: [
      { _id: 'all_chat', type: 'view' },
      { _id: 'statistics', type: 'view' },
    ],
    views: [
      {
        _id: 'all_chat',
        name: gettext('All chat'),
      }, {
        _id: 'statistics',
        name: gettext('Statistics'),
        type: VIEW_TYPE.STATISTIC,
      }
    ]
  }), []);

  const columns = useMemo(() => {
    return [
      {
        name: gettext('Title'),
        key: 'session_name',
        type: CellType.TEXT,
        editable: false,
        is_name_column: true,
        frozen: true,
        click: (row) => {
          context.eventBus.dispatch(EVENT_BUS_TYPE.EXPAND_ROW, row);
        },
      }, {
        name: gettext('User'),
        key: 'username',
        type: CellType.CREATOR,
      }, {
        name: gettext('Input tokens'),
        key: 'input_tokens',
        type: CellType.NUMBER,
      }, {
        name: gettext('Output tokens'),
        key: 'output_tokens',
        type: CellType.NUMBER,
      }, {
        name: gettext('Credit used'),
        key: 'credit_used',
        type: CellType.NUMBER,
      }, {
        name: gettext('Time'),
        key: 'created_at',
        type: CellType.CTIME,
      },
    ];
  }, []);

  const api = useMemo(() => ({
    getMetadata: (...params) => getMetadata(PORTAL_CHAT_TABLE_NAME, params[0], () => {
      const { view_id = 'open', start = 0, limit = 1000 } = params[0];
      if (view_id === 'all_chat') {
        const sorts = context.localStorage.getItem('sorts') || [];
        return chatAPI.listAdminChatSessions(projectUuid, { start, limit, sorts }).then(res => {
          const sessions = res?.data?.sessions || [];
          const records = sessions.map(session => ({ ...session, _pk: session.id }));
          return {
            data: { records }
          };
        });
      }
      return chatAPI.getAdminChatStatistics(projectUuid).then(res => {
        const {
          daily_session_counts,
          current = {},
          change_percent: changePercent = {},
        } = res.data;
        const comparisonLabel = gettext('vs. past month');
        return {
          data: {
            records: [
              {
                _pk: 1,
                name: gettext('Users'),
                column_key: 'user',
                summary_type: 'count',
                value: current.users || 0,
                comparison: { ...formatComparison(changePercent.users), label: comparisonLabel },
                type: STATISTIC_TYPE.CARD,
              },
              {
                _pk: 2,
                name: gettext('Input tokens'),
                column_key: 'input_tokens',
                summary_type: 'count',
                value: formatTokenCount(current.input_tokens || 0),
                comparison: { ...formatComparison(changePercent.input_tokens), label: comparisonLabel },
                type: STATISTIC_TYPE.CARD,
              },
              {
                _pk: 3,
                name: gettext('Output tokens'),
                column_key: 'output_tokens',
                summary_type: 'count',
                value: formatTokenCount(current.output_tokens || 0),
                comparison: { ...formatComparison(changePercent.output_tokens), label: comparisonLabel },
                type: STATISTIC_TYPE.CARD,
              },
              {
                _pk: 4,
                name: gettext('Credit used'),
                column_key: 'credit_used',
                summary_type: 'count',
                value: formatCreditCount(current.credit_used),
                comparison: { ...formatComparison(changePercent.credit_used), label: comparisonLabel },
                type: STATISTIC_TYPE.CARD,
              },
              {
                _pk: 5,
                name: gettext('Daily conversations in the past month'),
                column_key: 'date',
                summary_type: 'count',
                summary_column_key: 'count',
                value: daily_session_counts || [],
                type: STATISTIC_TYPE.LINE,
              }
            ],
          },
        };
      });
    }, true).then(res => {
      return {
        data: {
          rows: res?.data.records || [],
          columns,
        }
      };
    }),

    getViews: () => new Promise((resolve, reject) => resolve({ data: viewsData })),

    // view
    getView: (viewID) => {
      return new Promise((resolve, reject) => {
        const view = viewsData.views.find(v => v._id === viewID);
        resolve({ data: { view: {
          ...view,
          sorts: context.localStorage.getItem('sorts') || [],
        } } });
      });
    },

    modifyView: (viewID, viewData) => new Promise((resolve, reject) => {
      Object.keys(viewData).forEach(key => {
        context.localStorage.setItem(key, viewData[key]);
      });
      resolve({ data: { success: true } });
    }),
  }), [projectUuid, viewsData, columns, getMetadata]);

  const t = useMemo(() => {
    return {
      row: gettext('chat'),
      rows: gettext('chats'),
      Row: gettext('Chat'),
      Rows: gettext('Chats'),
    };
  }, []);

  return (
    <SeaMetadata
      className="seaqa-issues-analysis-metadata"
      isShowViewInURL={true}
      api={api}
      t={t}
      fixedColumnCount={1}
      localStorageNamePrefix={`seaqa-${projectUuid}-issues-analysis`}
      permission={PERMISSION_TYPES.READ_WRITE}
      viewTools={viewTools}
      settings={settings}
    >
      <SidePanelChat
        projectUuid={projectUuid}
        projectName={projectName}
        workspaceID={workspaceID}
        getMessages={(...params) => chatAPI.getAdminChatMessages(...params)}
      />
    </SeaMetadata>
  );
};

export default ChatAnalysis;
