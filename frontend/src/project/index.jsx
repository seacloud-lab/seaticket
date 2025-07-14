import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import SidePanel from './side-panel';
import MainPanel from './main-panel';
import { BAR_TYPE, CONNECTION_TYPES, BAR_TYPES } from './constants';
import { gettext } from '../constants';
import { Utils } from '../utils/utils';
import { CenteredLoading } from '../components';
import LocalStorage from '../utils/local-storage';

import './index.css';

const { projectUuid } = window.app.pageOptions;

const Project = () => {
  const [isLoading, setLoading] = useState(true);
  const [activeBar, setActiveBar] = useState({});

  const localStorage = useRef(new LocalStorage(projectUuid));

  const bars = useMemo(() => [
    {
      key: '_',
      name: '',
      children: BAR_TYPES
    }, {
      key: 'connections',
      name: gettext('Connections'),
      children: CONNECTION_TYPES
    }
  ], []);

  const toggleBar = useCallback((bar) => {
    if (activeBar?.key === bar.key) return;
    setActiveBar(bar);
  }, [activeBar]);

  useEffect(() => {
    const searchParams = Utils.getUrlSearches();
    const barKey = searchParams?.page || localStorage.current.getItem('page') || BAR_TYPE.SEARCH;
    const bar = BAR_TYPES.find(b => b.key === barKey) || CONNECTION_TYPES.find(b => b.key === barKey);
    setActiveBar(bar || BAR_TYPES[1]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!activeBar?.key) return;
    const newSearch = `?page=${activeBar.key}`;
    const { pathname, origin } = location;
    history.replaceState(null, null, origin + pathname + newSearch);
    localStorage.current.setItem('page', activeBar.key);
  }, [activeBar]);

  return (
    <div className="sea-qa-project">
      {isLoading ? (
        <CenteredLoading />
      ) : (
        <>
          <SidePanel bars={bars} activeBar={activeBar} toggleBar={toggleBar} />
          <MainPanel activeBar={activeBar} />
        </>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('wrapper'));
root.render(<Project />);
