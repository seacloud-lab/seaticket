import { gettext } from '@/constants';

const getOperationMessage = (operation) => {
  if (operation === '<break_context>') {
    return gettext('The context has been cleared. The following is a new conversation');
  }
  return '';
};

export default getOperationMessage;
