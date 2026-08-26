import AsyncSearchOptionsEditor from './async-search-options-editor';
import StaticOptionsEditor from './static-options-editor';

import './index.css';

const OptionsEditor = ({ isAsyncSearch, ...props }) => {
  const EditorComponent = isAsyncSearch ? AsyncSearchOptionsEditor : StaticOptionsEditor;
  return (<EditorComponent { ...props } />);
};

export default OptionsEditor;
