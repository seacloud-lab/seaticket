import { cloneElement, forwardRef, isValidElement } from 'react';
import DefaultEditor from '../../../../components/cell-editors';

const Editor = forwardRef(({ column, editorProps }, ref) => {
  if (!isValidElement(column.editor)) return (<DefaultEditor { ...editorProps } ref={ref} />);
  return cloneElement(column.editor, { ...editorProps, ref });
});

export default Editor;
