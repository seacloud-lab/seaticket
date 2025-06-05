import CollaboratorManager from './collaborator-manager';
import { dtableWebAPI } from '../../api/dtable-web-api';
import { DEFAULT_PAGE_SIZE, PAGE_TYPE, PAGE_SIZE, PAGE_LAYOUT_TYPE, DEFAULT_PAGE_MARGIN } from '../constants';

export const getCollaboratorManager = () => {
  const { mediaUrl } = window.app.config;
  let { collaborators } = window.app.pageOptions;
  collaborators = JSON.parse(collaborators);
  let collaboratorsCache = {};
  if (window.app) {
    collaboratorsCache = window.app.collaboratorsCache || {};
  }
  const userService = dtableWebAPI;
  const collaboratorManager = new CollaboratorManager(mediaUrl, userService, collaborators, collaboratorsCache);
  return collaboratorManager;
};


export const getPrintSize = (activePage) => {
  const { page_type = PAGE_TYPE.A4, page_size = DEFAULT_PAGE_SIZE, page_orientation, page_margin = DEFAULT_PAGE_MARGIN } = activePage;
  if (page_type === PAGE_TYPE.CUSTOM) {
    return {
      width: page_size.width,
      height: page_size.height,
      ...page_margin,
    };
  }
  const defaultPageSize = PAGE_SIZE[page_type];
  if (page_orientation === PAGE_LAYOUT_TYPE.LANDSCAPE) {
    return {
      width: defaultPageSize.height,
      height: defaultPageSize.width,
      ...page_margin,
    };
  }
  return {
    width: defaultPageSize.width,
    height: defaultPageSize.height,
    ...page_margin,
  };
};
