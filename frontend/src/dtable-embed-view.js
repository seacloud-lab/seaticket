import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n-dtable';
import MediaQuery from 'react-responsive';
import Loading from './components/loading';
import { mediaUrl, logoPath, logoWidth, logoHeight, siteTitle, serviceURL } from './utils/constants';
import './css/dtable-embed-view.css';

const gettext = window.gettext;
const siteRoot = window.app.config.siteRoot;
const { externalLinkToken, viewExternalLinkToken } = window.embed.pageOptions;

class DTableFormView extends React.Component {

  constructor(props) {
    super(props);
    window.localStorage.setItem('view-mode', 'table');
  }

  render() {
    let embedUrl = '';
    if (externalLinkToken) {
      embedUrl = `${serviceURL}/dtable/external-links/${externalLinkToken}/`;
    } else if (viewExternalLinkToken) {
      embedUrl = `${serviceURL}/dtable/view-external-links/${viewExternalLinkToken}/`;
    }
    let mobileEmbedUrl = embedUrl + '?mobile-view=true';
    let PCValue = `<iframe className="dtable-embed" src="${embedUrl}" frameBorder="0" width="100%" height="667" style="background: transparent; border: 1px solid #ccc;"></iframe>`;
    let mobileValue = `<iframe className="dtable-embed" src="${mobileEmbedUrl}" frameBorder="0" width="100%" height="667" style="background: transparent; border: 1px solid #ccc;"></iframe>`;
    const cls = 'dtable-embed-view';
    let logoUrl = logoPath.startsWith('http') ? logoPath : mediaUrl + logoPath;
    return (
      <>
        <div className={`${cls}-header`}>
          <a href={siteRoot}>
            <img src={logoUrl} height={logoHeight} width={logoWidth} title={siteTitle} alt="logo" />
          </a>
        </div>
        <div className={`${cls}-code p-4`}>
          <div className="d-flex align-items-center my-2">
            <span className="dtable-font dtable-icon-api" aria-hidden="true"/>
            <span className="ml-2" title={gettext('Desktop embed code')} aria-label={gettext('Desktop embed code')}>{gettext('Desktop embed code')}</span>
          </div>
          <textarea className="text-area-code w-100" readOnly value={PCValue}></textarea>
        </div>
        <div className={`${cls}-code p-4`}>
          <div className="d-flex align-items-center my-2">
            <span className="dtable-font dtable-icon-api" aria-hidden="true"/>
            <span className="ml-2" title={gettext('Mobile embed code')} aria-label={gettext('Mobile embed code')}>{gettext('Mobile embed code')}</span>
          </div>
          <textarea className="text-area-code w-100" readOnly value={mobileValue}></textarea>
        </div>
        <div className={`${cls}-embeds w-100`}>
          <MediaQuery query="(min-width: 767.8px)">
            <div className="desktop">
              <div className={`${cls}-embed-text`}>{gettext('Desktop embed preview')}</div>
              <div className="embed-container">
                <iframe className="dtable-embed" id="dtable-embed-PC" title="dtable-embed-PC" src={embedUrl} frameBorder="0"
                  height="667" width="100%">
                </iframe>
              </div>
            </div>
          </MediaQuery>
          <div className="mobile">
            <div className={`${cls}-embed-text`}>{gettext('Mobile embed preview')}</div>
            <div className="embed-container">
              <iframe className="dtable-embed" id="dtable-embed-mobile" title="dtable-embed-mobile" src={mobileEmbedUrl}
                frameBorder="0" height="667" width="100%">
              </iframe>
            </div>
          </div>
        </div>
      </>
    );
  }
}

const root = createRoot(document.getElementById('wrapper'));
root.render(
  <I18nextProvider i18n={i18n}>
    <Suspense fallback={<Loading/>}>
      <DTableFormView />
    </Suspense>
  </I18nextProvider>
);
