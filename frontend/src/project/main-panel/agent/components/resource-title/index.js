import React, { useState, useCallback, isValidElement, cloneElement } from 'react';
import classnames from 'classnames';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import { PORTAL_ISSUE_TYPE } from '@/project/main-panel/portal-issues/constants';
import { TICKET_TYPE } from '@/project/main-panel/tickets/constants';

import './index.css';

const { projectUuid } = window.app.pageOptions;

const ResourceTitle = ({ displayDetails = true, resource, className, trigger, children }) => {
  const [isShowDetails, setIsShowDetails] = useState(false);

  const openDetails = useCallback((event) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    setIsShowDetails(true);
  }, []);

  const closeDetails = useCallback(() => {
    setIsShowDetails(false);
  }, []);

  const hasDetails = resource?.type === TICKET_TYPE || resource?.type === PORTAL_ISSUE_TYPE || (resource?.connection_id && resource?._id);
  const onClick = hasDetails && displayDetails ? openDetails : () => {};

  return (
    <>
      {children && isValidElement(children) ? (
        <>
          {cloneElement(children, { resource: resource, onClick: onClick })}
        </>
      ) : (
        <div
          className={classnames(className, { 'seaqa-agent-resource-title': displayDetails && hasDetails })}
          title={resource?.title}
          onClick={onClick}
        >
          {resource?.title}
        </div>
      )}
      {isShowDetails && (
        <ResourceDetailsDialog
          projectUuid={projectUuid}
          resource={resource}
          highlight={trigger}
          onToggle={closeDetails}
        />
      )}
    </>
  );
};

export default ResourceTitle;
