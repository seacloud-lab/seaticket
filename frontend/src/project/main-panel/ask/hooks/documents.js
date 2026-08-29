import React, { useCallback, useContext, useEffect, useState } from 'react';

const DocumentsContext = React.createContext(null);

export const DocumentsProvider = ({ children, sessionId, openDocumentCallback }) => {
  const [isShowDocuments, setIsShowDocuments] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [currentDocument, setCurrentDocument] = useState(null);

  const openDocument = useCallback((document) => {
    setIsShowDocuments(true);
    if (!documents.find(d => d.url === document.url)) {
      setDocuments([document, ...documents]);
    }
    if (currentDocument?.url !== document.url) {
      setCurrentDocument(document);
    }
    openDocumentCallback && openDocumentCallback();
  }, [documents, currentDocument, openDocumentCallback]);

  const closeDocument = useCallback((document) => {
    const documentIndex = documents.findIndex(d => d.url === document.url);
    let newDocuments = documents.slice(0);
    newDocuments.splice(documentIndex, 1);
    let nextDocumentIndex = documentIndex + 1;
    if (!newDocuments[nextDocumentIndex]) {
      nextDocumentIndex = 0;
    }
    if (newDocuments.length === 0) {
      setIsShowDocuments(false);
    }
    setDocuments(newDocuments);
    setCurrentDocument(newDocuments[nextDocumentIndex] || null);
  }, [documents]);

  const closeDocuments = useCallback(() => {
    setIsShowDocuments(false);
  }, []);

  useEffect(() => {
    setDocuments([]);
    setCurrentDocument(null);
  }, [sessionId]);

  return (
    <DocumentsContext.Provider value={{
      isShowDocuments,
      documents,
      currentDocument,
      openDocument,
      closeDocument,
      closeDocuments,
    }}>
      {children}
    </DocumentsContext.Provider>
  );
};

export const useDocuments = () => {
  const context = useContext(DocumentsContext);
  if (!context) {
    throw new Error('\'DocumentsContext\' is null');
  }
  return context;
};
