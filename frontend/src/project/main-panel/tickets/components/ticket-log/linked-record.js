import React, { useState } from 'react';
import { ResourceDetailsDialog } from '@/project/components';

const LinkedRecord = ({ record, columns, projectUuid, permission, children }) => {
  const [isShowResourceDetailsDialog, setIsShowResourceDetailsDialog] = useState(false);

  if (!record) return;

  return (
    <>
      <span
        className="seaqa-log-inline-link "
        onClick={() => setIsShowResourceDetailsDialog(true)}
      >
        {children || record.title}
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
