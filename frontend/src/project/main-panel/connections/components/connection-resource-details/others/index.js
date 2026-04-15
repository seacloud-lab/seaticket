import React, { useMemo } from 'react';
import { CONNECTION_TYPE } from '../../../constants';
import GitHubIssuesDetails from './github-issues-details';
import EmailDetails from './email-details';
import DiscourseForumDetails from './discourse-forum-details';

const ConnectionResourceOtherDetails = ({
  connection,
  ...props
}) => {
  const connectionType = useMemo(() => connection.type, [connection]);
  if (connectionType === CONNECTION_TYPE.GITHUB_ISSUE) {
    return (<GitHubIssuesDetails { ...props }/>);
  }
  if (connectionType === CONNECTION_TYPE.EMAIL) {
    return (<EmailDetails { ...props } />);
  }
  if (connectionType === CONNECTION_TYPE.DISCOURSE_FORUM) {
    return (<DiscourseForumDetails { ...props } />);
  }
  return null;
};

export default ConnectionResourceOtherDetails;
