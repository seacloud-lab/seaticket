import React from 'react';
import { createRoot } from 'react-dom/client';
import AppMain from './pages/dtable-edit-collection-table/app-main';

import './css/dtable-edit-form.css';
import './css/dtable-edit-collection-table.css';

const { dtableMetadata, formConfig } = window.shared.pageOptions;

class DtableEditCollectionTableView extends React.Component {

  render() {
    let metadata = JSON.parse(dtableMetadata).metadata;
    let formConfigInfo = JSON.parse(formConfig);
    let tables = metadata.tables;
    return <AppMain formConfigInfo={formConfigInfo} tables={tables} />;
  }
}

const root = createRoot(document.getElementById('wrapper'));
root.render(<DtableEditCollectionTableView />);
