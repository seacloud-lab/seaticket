import AsyncOptionsEditor from './async-options-editor';
import SyncOptionsEditor from './sync-options-editor';

import './index.css';

const OptionsEditor = ({ isAsync, ...props }) => {
  const OptionsEditorComponent = isAsync ? AsyncOptionsEditor : SyncOptionsEditor;
  return (<OptionsEditorComponent { ...props } />);
};

export default OptionsEditor;
