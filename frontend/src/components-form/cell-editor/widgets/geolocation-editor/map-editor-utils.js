import { isEmptyObject } from 'dtable-utils';
import { isValidPosition } from '../../../utils/utils';
import { gettext } from '../../../../utils/constants';

const createBMapZoomControl = (BMap) => {
  function ZoomControl() {
    this.defaultAnchor = window.BMAP_ANCHOR_BOTTOM_RIGHT;
    this.defaultOffset = new BMap.Size(10, 20);
  }

  ZoomControl.prototype = new window.BMap.Control();

  ZoomControl.prototype.initialize = (map) => {
    let div = document.createElement('div');
    div.className = 'BMap-zoom-container';
    let enlarge = document.createElement('div');
    enlarge.className = 'BMap-zoom-btn enlarge';
    let enlargeIcon = document.createElement('i');
    enlargeIcon.className = 'dtable-font dtable-icon-enlarge';
    enlarge.appendChild(enlargeIcon);
    enlarge.onclick = function (e){
      map.zoomTo(map.getZoom() + 1);
    };
    div.appendChild(enlarge);
    let shrink = document.createElement('div');
    shrink.className = 'BMap-zoom-btn shrink';
    let shrinkIcon = document.createElement('i');
    shrinkIcon.className = 'dtable-font dtable-icon-narrow';
    shrink.appendChild(shrinkIcon);
    shrink.onclick = function (e){
      map.zoomTo(map.getZoom() - 1);
    };
    div.appendChild(shrink);
    if (window.isMobile) {
      shrinkIcon.style.fontSize = '20px';
      enlargeIcon.style.fontSize = '20px';
      setNodeStyle(enlarge, 'height: 45px; width: 45px; line-height: 45px');
      setNodeStyle(shrink, 'height: 45px; width: 45px; line-height: 45px');
    } else {
      setNodeStyle(enlarge, 'height: 30px; width: 30px; line-height: 30px');
      setNodeStyle(shrink, 'height: 30px; width: 30px; line-height: 30px');
    }
    map.getContainer().appendChild(div);
    return div;
  };
  return ZoomControl;
};

const createBMapGeolocationControl = (BMap, callback) => {
  function GeolocationControl() {
    this.defaultAnchor = window.BMAP_ANCHOR_BOTTOM_RIGHT;
    if (window.isMobile) {
      this.defaultOffset = new BMap.Size(10, 130);
    } else {
      this.defaultOffset = new BMap.Size(10, 98);
    }
  }
  GeolocationControl.prototype = new window.BMap.Control();
  GeolocationControl.prototype.initialize = (map) => {
    let div = document.createElement('div');
    div.className = 'BMap-geolocation-control';
    let icon = document.createElement('i');
    icon.className = 'dtable-font dtable-icon-current-location';
    div.appendChild(icon);
    if (window.isMobile) {
      setNodeStyle(div, 'height: 45px; width: 45px; line-height: 45px');
      setNodeStyle(icon, 'font-size: 20px');
    } else {
      setNodeStyle(div, 'height: 30px; width: 30px; line-height: 30px');
    }
    div.onclick = (e) => {
      const geolocation = new BMap.Geolocation();
      div.className = 'BMap-geolocation-control BMap-geolocation-control-loading';
      geolocation.getCurrentPosition((result) => {
        div.className = 'BMap-geolocation-control';
        if (result) {
          const point = result.point;
          map.setCenter(point);
          callback(null, point);
        } else {
          // Positioning failed
          callback(true);
        }
      });
    };
    map.getContainer().appendChild(div);
    return div;
  };

  return GeolocationControl;
};

const setNodeStyle = (dom, styleText) => {
  dom.style.cssText += styleText;
};

export const getBaiduMapKey = () => {
  if (window.app && window.app.pageOptions && window.app.pageOptions.dtableBaiduMapKey) {
    return window.app.pageOptions.dtableBaiduMapKey;
  } else if (window.shared && window.shared.pageOptions && window.shared.pageOptions.dtableBaiduMapKey) {
    return window.shared.pageOptions.dtableBaiduMapKey;
  } else {
    return '';
  }
};

export const loadMapSource = (mapKey) => {
  let script = document.createElement('script');
  script.type = 'text/javascript';
  const url = `https://api.map.baidu.com/api?v=3.0&ak=${mapKey}}&callback=renderBaiduMap`;
  script.src = url;
  document.body.appendChild(script);
};

export const initSelectionValue = (map, value, setValue, onSubmit) => {
  let { lng, lat } = getInitCenter(true);
  const { lngLat, address, title } = value;
  if (lngLat && isValidPosition(lngLat.lng, lngLat.lat)) {
    lng = lngLat.lng;
    lat = lngLat.lat;
    addSelectionMarkerByPosition(map, value, setValue, onSubmit);
  } else {
    const detail = title || address || '';
    const geoCoder = new window.BMap.Geocoder();
    geoCoder.getPoint(detail, (point) => {
      if (!point) return;
      let newLngLat = {};
      lng = point.lng;
      lat = point.lat;
      newLngLat = { lng, lat };
      value = Object.assign({}, value, { lngLat: newLngLat });
      addSelectionMarkerByPosition(map, value, setValue, onSubmit);
    });
  }
  return { lng, lat };
};

export const getInitCenter = () => {
  // set beijing as default map center
  let lng = 116.404; let lat = 39.915; let zoom = 5;
  let center = localStorage.getItem('form-geolocation-map-center');
  if (center) {
    center = JSON.parse(center);
    lng = center.lng || lng;
    lat = center.lat || lat;
    zoom = center.zoom || zoom;
  }
  return { lng, lat, zoom };
};

export const getInitValue = (value) => {
  if (!value || isEmptyObject(value)) {
    return { address: '', title: '', tag: '', lngLat: {} };
  }
  return value;
};

export const addMapControl = (map, geolocationCallback) => {
  const ZoomControl = createBMapZoomControl(window.BMap);
  let zoomControl = new ZoomControl();
  const GeolocationControl = createBMapGeolocationControl(window.BMap, geolocationCallback);
  let geolocationControl = new GeolocationControl();
  map.addControl(zoomControl);
  map.addControl(geolocationControl);
  return geolocationControl;
};

export const getSelectionLocationValue = (result) => {
  let value = {};
  const { surroundingPois, address, point } = result;
  if (surroundingPois.length === 0) {
    value.address = address;
    value.lngLat = { lng: point.lng, lat: point.lat };
    value.tag = [];
    value.title = '';
  } else {
    const position = surroundingPois[0];
    const { address, title, tags, point } = position;
    value.address = address || '';
    value.title = title || '';
    value.tag = tags || [];
    value.lngLat = { lng: point.lng, lat: point.lat };
  }
  return value;
};

const getSelectionLabelContent = (value) => {
  const { address, title, tag } = value;
  const tagContent = Array.isArray(tag) && tag.length > 0 ? tag[0] : '';
  if (title) {
    return (
      `
        <div class='selection-label-content' id='selection-label-content'>
          <i class='dtable-font dtable-icon-down3'></i>
          <span class='label-title text-truncate' title=${title}>${title}</span>
          ${tagContent && `<span class='label-tag'>${tagContent}</span>`}
          <span class='dtable-font dtable-icon-x' id='selection-label-close'></span>
          <span class='label-address-tip'>${gettext('Address')}</span>
          <span class='label-address text-truncate' title=${address}>${address}</span>
          <div class='label-submit btn btn-primary' id='selection-label-submit'>${gettext('Fill in')}</div>
        </div>
      `
    );
  }
  return (
    `
      <div class='selection-label-content simple' id='selection-label-content'>
        <i class='dtable-font dtable-icon-down3'></i>
        <span class='dtable-font dtable-icon-x' id='selection-label-close'></span>
        <span class='label-address text-truncate simple' title=${address}>${address}</span>
        <div class='label-submit btn btn-primary' id='selection-label-submit'>${gettext('Fill in')}</div>
      </div>
    `
  );
};

export const addSelectionMarkerByPosition = (map, value, setValue, onSubmit) => {
  const { lngLat } = value;
  let point = new window.BMap.Point(lngLat.lng, lngLat.lat);
  const marker = new window.BMap.Marker(point, { offset: new window.BMap.Size(-2, -5) });
  if (map) {
    map.clearOverlays();
    const content = getSelectionLabelContent(value);
    const translateY = value.title ? '30%' : '45%';
    const label = new window.BMap.Label(content, { offset: new window.BMap.Size(9, -5) });
    label.setStyle({
      display: 'block',
      border: 'none',
      backgroundColor: '#ffffff',
      boxShadow: '1px 2px 1px rgba(0,0,0,.15)',
      padding: '3px 10px',
      transform: `translate(-50%, ${translateY})`,
      borderRadius: '3px',
      fontWeight: '500',
      left: '7px'
    });
    marker.setLabel(label);
    map.addOverlay(marker);
    map.centerAndZoom(point, 10);
    addLabelEventListener(map, marker, value, setValue, onSubmit);
  }
};

const addLabelEventListener = (map, marker, value, setValue, onSubmit) => {
  if (map) {
    setTimeout(() => {
      const label = document.getElementById('selection-label-content');
      if (label) {
        label.addEventListener('click', (e) => {
          e.stopPropagation();
        });
      }
      const closeElement = document.getElementById('selection-label-close');
      if (closeElement) {
        closeElement.addEventListener('click', (e) => {
          e.stopPropagation();
          marker.getLabel().remove();
          map.clearOverlays();
        });
      }
      const submitElement = document.getElementById('selection-label-submit');
      if (submitElement) {
        submitElement.addEventListener('click', (e) => {
          e.stopPropagation();
          // submit value
          setValue(value);
          onSubmit();
        });
      }
    }, 10);
  }
};
