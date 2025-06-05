export const transferAssetURL = (url, workflowToken, taskId, columnKey, columnType) => {
  if (url.indexOf('?') !== -1) {
    return `${url}&workflow_token=${workflowToken}&task_id=${taskId}&column_key=${columnKey}&column_type=${columnType}`;
  } else {
    return `${url}?workflow_token=${workflowToken}&task_id=${taskId}&column_key=${columnKey}&column_type=${columnType}`;
  }
};

export const transferAssetPreviewURL = (url, workflowToken, taskId, columnKey, columnType, isReadOnly) => {
  url = url.replace('/asset/', '/asset-preview/');
  const readOnly = isReadOnly ? 'true' : 'false';
  if (url.indexOf('?') !== -1) {
    return `${url}&workflow_token=${workflowToken}&task_id=${taskId}&column_key=${columnKey}&column_type=${columnType}&readonly=${readOnly}`;
  } else {
    return `${url}?workflow_token=${workflowToken}&task_id=${taskId}&column_key=${columnKey}&column_type=${columnType}&readonly=${readOnly}`;
  }
};

export const transferAssetURLBack = (url) => {
  if (url.indexOf('?') !== -1 && url.indexOf('workflow_token=') !== -1 && url.indexOf('task_id=') !== -1) {
    return url.slice(0, url.indexOf('?'));
  }
  return url;
};
