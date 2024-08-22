import { GeoJSONLayer } from 'react-mapbox-gl';

const SuburbBoundaries = () => {
  return (
    <GeoJSONLayer
      data="http://data.gov.au/geoserver/vic-suburb-locality-boundaries-psma-administrative-boundaries/wfs?request=GetFeature&typeName=af33dd8c_0534_4e18_9245_fc64440f742e&outputFormat=json"
      // data="http://fiftytwo-ovenbird.netlify.com/victoria_suburbs.json"
      lineLayout={{ visibility: 'visible' }}
    />
  );
};

export default SuburbBoundaries;
