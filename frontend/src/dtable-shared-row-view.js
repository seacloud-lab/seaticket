import React from 'react';
import { createRoot } from 'react-dom/client';
import AppMain from './pages/dtable-share-row/app-main';

import './css/dtable-share-row.css';

const { rowContent, columns } = window.shared.pageOptions;

class SharedDTableRowView extends React.Component {

  render() {

    return (
      <AppMain row={JSON.parse(rowContent)['row']} columns={JSON.parse(columns)['columns']}/>
    );
  }

}

const root = createRoot(document.getElementById('wrapper'));
root.render(<SharedDTableRowView />);
