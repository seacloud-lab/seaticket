import { usePortalIssuesMetadata } from '../main-panel/portal-issues/hooks';
import { useTags } from '../main-panel/tags/hooks';
import { useMetadata } from '../main-panel/tickets/hooks';
import { DataProvider, useData } from './data';

export {
  DataProvider, useData,
  useMetadata,
  useTags,
  usePortalIssuesMetadata,
};
