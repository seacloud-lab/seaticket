import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import i18n from './_i18n/i18n-sdoc-editor';
import Loading from './components/loading';
import SdocEditor from './pages/sdoc/sdoc-editor';

const { serviceURL, avatarURL, siteRoot, lang, mediaUrl, isPro } = window.app.config;

const { username, name, docPath, docName, docUuid, seadocAccessToken, seadocServerUrl, assetsUrl, canEditFile, filePerm
} = window.app.pageOptions;


window.seafile = {
  // repoID,
  docPath,
  docName,
  docUuid,
  isOpenSocket: true,
  serviceUrl: serviceURL,
  accessToken: seadocAccessToken,
  sdocServer: seadocServerUrl,
  name,
  username,
  avatarURL,
  siteRoot,
  assetsUrl,
  lang,
  mediaUrl,
  canEditFile,
  docPerm: filePerm,
  isPro: isPro === 'True' ? true : false,
};

const root = createRoot(document.getElementById('wrapper'));
root.render(
  <I18nextProvider i18n={ i18n } >
    <Suspense fallback={<Loading />}>
      <SdocEditor />
    </Suspense>
  </I18nextProvider>
);
