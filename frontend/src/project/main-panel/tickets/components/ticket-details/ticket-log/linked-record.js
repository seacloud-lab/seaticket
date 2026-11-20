import React, { useState } from 'react';
import { ResourceDetailsDialog } from '@/project/components';
import { getConnectionIcon } from '@/project/main-panel/connections/utils';
import './linked-record.css';

const LinkedRecord = ({ record, columns, projectUuid, permission, type, children }) => {
  const [isShowResourceDetailsDialog, setIsShowResourceDetailsDialog] = useState(false);

  if (!record) return;

  return (
    <>
      <span
        className="seaqa-log-inline-link"
        onClick={() => setIsShowResourceDetailsDialog(true)}
      >
        <img
          className="seaqa-log-inline-link-icon"
          src={getConnectionIcon(type || record.type || record.connection_type)}
          alt=""
        />
        <span className="seaqa-log-inline-link-text" title={record.title}>
          {children || record.title}
        </span>
      </span>
      {isShowResourceDetailsDialog && (
        <ResourceDetailsDialog
          projectUuid={projectUuid}
          resource={record}
          isShowIcon={true}
          columns={columns}
          permission={permission}
          onToggle={() => setIsShowResourceDetailsDialog(false)}
        />
      )}
    </>
  );
};

export default LinkedRecord;
