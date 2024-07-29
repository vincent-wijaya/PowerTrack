'use client';
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from 'react-leaflet';
import { useMapEvents } from 'react-leaflet/hooks';
import { VictorianSuburbs } from '../data/victorian-suburbs';
import { GreaterVictoria } from '@/data/greater-victoria';
import fetchEnergyConsumption from '../api/energyConsumption';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import { LatLng, LatLngBounds } from 'leaflet';
import { useRouter } from 'next/navigation';
import { OutageIcon } from './icons/outageIcon';
import { Feature, FeatureCollection } from 'geojson';

interface DataItem {
  [suburb: string]: number;
}

interface MyComponentProps {
  zoomLevel: number;
  setZoomLevel: (zoom: number) => void;
}

function MyComponent(props: MyComponentProps) {
  const { zoomLevel, setZoomLevel } = props;
  setZoomLevel(8);
  const mapEvents = useMapEvents({
    zoomend: () => {
      let newZoomValue = mapEvents.getZoom();
      setZoomLevel(newZoomValue);
    },
  });
  return null;
}

function getColorBasedOnConsumption(consumption: number | undefined): string {
  if (consumption == null) {
    return "black";
  }

  const minConsumption = 0; // Minimum possible consumption value
  const maxConsumption = 1000; // Maximum possible consumption value

  // Clamp consumption value between min and max
  const clampedConsumption = Math.max(minConsumption, Math.min(consumption, maxConsumption));

  // Calculate the interpolation factor (0 to 1)
  const factor = (clampedConsumption - minConsumption) / (maxConsumption - minConsumption);

  // Interpolate between yellow (255, 255, 0) and deep purple (75, 0, 130)
  // Interpolate between light green (144, 238, 144) and deep blue (0, 0, 139)
  const startColor = { r: 144, g: 238, b: 144 };
  const endColor = { r: 0, g: 0, b: 139 };

  const red = Math.round(startColor.r + factor * (endColor.r - startColor.r));
  const green = Math.round(startColor.g + factor * (endColor.g - startColor.g));
  const blue = Math.round(startColor.b + factor * (endColor.b - startColor.b));

  return `rgb(${red}, ${green}, ${blue})`;
}

export default function Map(props: {className?: string}) {
  const router = useRouter();
  const [victorianSuburbs, setVictorianSuburbs] = useState<FeatureCollection<any, any>>({
    type: "FeatureCollection",
    features: [],
  });
  const [powerOutageCoords, setPowerOutageCoords] = useState<LatLng[]>([]);

  const [geoJSONKey, setGeoJSONKey] = useState(0); // Add key state
  const [zoomLevel, setZoomLevel] = useState(5);
  const bounds = new LatLngBounds(
    { lat: -37.5, lng: 140 }, // Southwest corner
    { lat: -39, lng: 148 } // Northeast corner
  );

  function handleSuburbClick(suburbName: string) {
    router.push(`/regionalDashboard/${suburbName}`);
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await fetchEnergyConsumption();
        if (result) {
          const body = result as DataItem;
          const geoJSONPromises = body.energy.map(async (item) => {
            const response = await fetch(`/data/suburbs/${item.suburb_id}.json`);
            if (!response.ok) {
              throw new Error(`Failed to fetch GeoJSON for suburb_id: ${item.suburb_id}`);
            }
            const geoJSON: Feature = await response.json();
            return { geoJSON, amount: item.amount };
          });

          const geoJSONResults = await Promise.all(geoJSONPromises);

          const features = geoJSONResults.map((result) => {
            // Add the energy amount as a property to the feature
            result.geoJSON.properties = {
              ...result.geoJSON.properties,
              amount: result.amount,
            };
            return result.geoJSON;
          });

          const featureCollection: FeatureCollection = {
            type: "FeatureCollection",
            features: features,
          };

          setVictorianSuburbs(featureCollection);
          console.log(featureCollection, "featurecollection");
        } else {
          console.error("Failed to fetch data:", result);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();

    const intervalId = setInterval(fetchData, 5000); // Fetch data every 50 seconds
    return () => clearInterval(intervalId);
  }, [victorianSuburbs]);

  useEffect(() => {
    setGeoJSONKey((prevKey) => prevKey + 1);
  }, [victorianSuburbs]);

  return (
    <MapContainer className={props.className} zoom={10} scrollWheelZoom={true} bounds={bounds} center={new LatLng(-37.0483, 143.7354)}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MyComponent zoomLevel={zoomLevel} setZoomLevel={setZoomLevel} />
      <GeoJSON
        key={geoJSONKey}
        data={zoomLevel <= 7 ? GreaterVictoria : victorianSuburbs} // Conditionally set data based on zoom level
        onEachFeature={(feature, layer: any) => {
          const energyData = feature.properties["amount"];
          const suburbName = feature.properties["name"];
          const coordinates = layer.getBounds().getCenter(); // Get the center coordinates of the feature

          if (energyData >= 0) {
            const fillColor = getColorBasedOnConsumption(energyData);
            layer.setStyle({
              fillColor: fillColor,
              weight: 1,
              opacity: 1,
              color: fillColor,
              fillOpacity: 0.7,
            });

            // Add popup with amount value
            if (energyData > 0) {
              layer.bindPopup(`<a href="regionalDashboard/${suburbName}">${suburbName}</a> <br>Energy: ${energyData}`);
            } else {
              layer.bindPopup(`<a href="regionalDashboard/${suburbName}">${suburbName}</a> <br>Power Outage!`);
              layer.setStyle({
                fillColor: "red",
                weight: 1,
                opacity: 1,
                color: "red",
                fillOpacity: 0.7,
              });
              setPowerOutageCoords((prevCoords) => [...prevCoords, coordinates]);
            }
          } else {
            layer.setStyle({
              fillColor: "black",
              weight: 1,
              opacity: 1,
              color: "black",
              fillOpacity: 0.7,
            });

            // Add popup with default message
            layer.bindPopup(`Area: ${suburbName} <br>No energy data available`);
          }

          layer.on({
            click: () => handleSuburbClick(suburbName),
          });
        }}
      />
      {powerOutageCoords.map((coord, index) => (
        <Marker key={index} position={coord} icon={OutageIcon}>
          <Popup>Power Outage!</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
