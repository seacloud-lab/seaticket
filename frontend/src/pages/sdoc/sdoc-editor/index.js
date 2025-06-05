import React, { Fragment } from 'react';
import { SimpleEditor, SimpleViewer } from '@seafile/sdoc-editor';

export default class SdocEditor extends React.Component {

  render() {
    const { canEditFile } = window.seafile;
    return (
      <Fragment>
        {canEditFile && <SimpleEditor showFileTags={false} showDocOperations={false} showComment={false} />}
        {!canEditFile && <SimpleViewer/>}
      </Fragment>
    );
  }
}
