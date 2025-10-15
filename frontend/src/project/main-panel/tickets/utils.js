import { gettext } from '@/constants';
import { TICKET_STATUS_OPTIONS } from './constants';
import { RATE_LIST } from '@/sea-metadata/components/cell-editors/rate-editor/constants';
import { BAR_TYPE } from '@/project/constants';
import copy from 'copy-to-clipboard';
import { toaster } from '@/components';

export const generatorTicketURL = ({ row, workspaceID, projectName }) => {
  const { origin } = location;
  return `${origin}/workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.TICKET}/${row._id}/`;
};

export const generatorRowCopyLinkTool = ({ row, workspaceID, projectName }) => {
  return {
    key: 'copy',
    icon: 'copy',
    name: gettext('Copy link'),
    callback: (event) => {
      event && event.stopPropagation();
      event?.nativeEvent && event.nativeEvent.stopImmediatePropagation();
      const url = generatorTicketURL({ row, workspaceID, projectName });
      copy(url);
      toaster.success(gettext('The ticket link has been copied'));
    },
  };
};

export const generatorRowsMoreTool = ({ rows, modifyRows }) => {
  return {
    key: 'more',
    icon: 'more',
    children: [
      {
        name: gettext('Set status'),
        key: 'status',
        children: TICKET_STATUS_OPTIONS.map((o) => {
          return {
            key: o.id,
            name: o.name,
            callback: () => {
              let rowIds = [];
              let idRowUpdates = {};
              let idOriginalRowUpdates = {};
              let idOldRowData = {};
              let idOriginalOldRowData = {};
              rows.forEach(row => {
                const { _id, status } = row;
                rowIds.push(_id);
                idRowUpdates[_id] = { status: o.id };
                idOriginalRowUpdates[_id] = { status: o.id };
                idOldRowData[_id] = { status };
                idOriginalOldRowData[_id] = { status };
              });
              modifyRows && modifyRows(rowIds, idRowUpdates, idOriginalRowUpdates, idOldRowData, idOriginalOldRowData);
            },
          };
        })
      }, {
        name: gettext('Set priority'),
        key: 'priority',
        children: RATE_LIST.map(o => {
          return {
            ...o,
            key: o.value,
            icon: o.icon,
            callback: () => {
              let rowIds = [];
              let idRowUpdates = {};
              let idOriginalRowUpdates = {};
              let idOldRowData = {};
              let idOriginalOldRowData = {};
              rows.forEach(row => {
                const { _id, priority } = row;
                rowIds.push(_id);
                idRowUpdates[_id] = { priority: o.value };
                idOriginalRowUpdates[_id] = { priority: o.value };
                idOldRowData[_id] = { priority };
                idOriginalOldRowData[_id] = { priority };
              });
              modifyRows && modifyRows(rowIds, idRowUpdates, idOriginalRowUpdates, idOldRowData, idOriginalOldRowData);
            },
          };
        })
      }
    ]
  };
};
