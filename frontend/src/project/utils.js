import { server } from '@/constants';

export const generatorProjectGitHubOauthURL = (projectUuid) => {
  return `${server}/github/oauth/auth/?project_uuid=${projectUuid}`;
};
