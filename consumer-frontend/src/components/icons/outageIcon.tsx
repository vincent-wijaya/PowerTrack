import { Icon } from 'leaflet';

const OutageIcon = new Icon({
  iconUrl: 'warning.png',
  iconSize: [35, 35], // size of the icon
  iconAnchor: [0, 0], // point of the icon which will correspond to marker's location
  popupAnchor: [0, 0], // point from which the popup should open relative to the iconAnchor
});

export { OutageIcon };
