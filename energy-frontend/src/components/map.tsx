'use client';
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from 'react-leaflet';
import { LatLng, LatLngBounds, Polygon } from 'leaflet';
import { useRouter } from 'next/navigation';
import { OutageIcon } from './icons/outageIcon';
import useSWR from 'swr';
import { POLLING_RATE } from '@/config';
import { fetcher } from '@/utils';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import { Feature, FeatureCollection, MultiPoint, Position } from 'geojson'; // Ensure correct import for geojson types

type MapItem = {
  suburb_id: number;
  amount: number;
  date: string;
};

type MapData = {
  energy: MapItem[];
};

type Consumer = {
  id: number;
  street_address: string;
  latitude: number;
  longitude: number;
  high_priority: boolean;
};

type Cluster = {
  consumers: Consumer[];
};

type PowerOutages = {
  clusters: Cluster[];
  consumers: Consumer[];
};

type OutageData = {
  power_outages: PowerOutages;
};

function getColorBasedOnConsumption(consumption: number | undefined): string {
  if (consumption == null) {
    return 'black';
  }

  const minConsumption = 0;
  const maxConsumption = 1000;

  const clampedConsumption = Math.max(
    minConsumption,
    Math.min(consumption, maxConsumption)
  );
  const factor =
    (clampedConsumption - minConsumption) / (maxConsumption - minConsumption);

  const startColor = { r: 144, g: 238, b: 144 };
  const endColor = { r: 0, g: 0, b: 139 };

  const red = Math.round(startColor.r + factor * (endColor.r - startColor.r));
  const green = Math.round(startColor.g + factor * (endColor.g - startColor.g));
  const blue = Math.round(startColor.b + factor * (endColor.b - startColor.b));

  return `rgb(${red}, ${green}, ${blue})`;
}

export default function Map(props: { className?: string }) {
  const router = useRouter();
  const [powerOutageData, setPowerOutageData] = useState<
    { latLng: LatLng; id: number }[]
  >([]);
  const [victorianSuburbs, setVictorianSuburbs] = useState<
    FeatureCollection<MultiPoint>
  >({
    type: 'FeatureCollection',
    features: [],
  });

  const bounds = new LatLngBounds(
    { lat: -37.5, lng: 140 },
    { lat: -39, lng: 148 }
  );

  const { data: mapData }: { data: MapData } = useSWR(
    `${process.env.NEXT_PUBLIC_API_URL}/retailer/map`,
    fetcher,
    {
      refreshInterval: POLLING_RATE,
    }
  );

  const { data: outageData }: { data: OutageData } = useSWR(
    `${process.env.NEXT_PUBLIC_API_URL}/retailer/powerOutages`,
    fetcher,
    {
      refreshInterval: POLLING_RATE,
    }
  );

  useEffect(() => {
    async function fetchData() {
      if (mapData && outageData) {
        const consumptionResults = mapData;
        const outageResults = outageData.power_outages;

        const response = await fetch('/data/combined.json');
        if (!response.ok) {
          throw new Error('Failed to fetch combined JSON data');
        }

        const suburbs: FeatureCollection<any, any> = await response.json();

        // Process consumption data to turn into GeoJSON features for the map
        const consumptionGeoJSONPromises = consumptionResults.energy.map(
          async (item) => {
            const feature = suburbs.features.find(
              (f) => f.properties?.id === item.suburb_id.toString()
            );
            if (!feature) {
              throw new Error(
                `Feature not found for suburb_id: ${item.suburb_id}`
              );
            }
            return { geoJSON: feature, amount: item.amount };
          }
        );

        const consumptionGeoJSONResults = await Promise.all(
          consumptionGeoJSONPromises
        );

        const consumptionFeatures = consumptionGeoJSONResults.map(
          (consumptionResult) => {
            consumptionResult.geoJSON.properties = {
              ...consumptionResult.geoJSON.properties,
              amount: consumptionResult.amount,
            };
            return consumptionResult.geoJSON;
          }
        );

        // Process outage data to turn each consumer into a marker
        const outageMarkers = outageResults.consumers.map((consumer) => {
          if (!consumer.latitude || !consumer.longitude) {
            throw new Error(
              `Missing latitude or longitude for consumer with id: ${consumer.id}`
            );
          }
          return {
            latLng: new LatLng(consumer.latitude, consumer.longitude),
            id: consumer.id,
          };
        });

        // Process cluster data to turn clusters into GeoJSON features
        const outageGeoJSONPromises = outageResults.clusters.map(
          async (cluster) => {
            // Map consumer data to coordinates and ensure they're typed as Position
            const coordinates: Position[] = cluster.consumers.map(
              (consumer) => {
                if (!consumer.latitude || !consumer.longitude) {
                  throw new Error(
                    `Missing latitude or longitude for consumer with id: ${consumer.id}`
                  );
                }
                return [consumer.longitude, consumer.latitude] as Position;
              }
            );

            const geoJSONFeature: Feature = {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [coordinates],
              },
              properties: {
                outage: true, // Mark the feature as an outage
              },
            };
            return geoJSONFeature;
          }
        );

        const outageFeatures = await Promise.all(outageGeoJSONPromises);

        const allFeatures = [...outageFeatures, ...consumptionFeatures];

        const featureCollection: FeatureCollection<any, any> = {
          type: 'FeatureCollection',
          features: allFeatures,
        };

        setVictorianSuburbs(featureCollection);
        setPowerOutageData(outageMarkers); // Set all consumer coordinates as outage markers
      }
    }

    fetchData();
  }, [mapData, outageData]);

  function handleSuburbClick(suburb_id: string) {
    router.push(`/main/regionalDashboard/${suburb_id}`);
  }

  const onEachFeature = (feature: Feature<any>, layer: any) => {
    const isOutage = feature.properties['outage'];

    if (isOutage) {
      layer.setStyle({
        fillColor: 'red',
        weight: 1,
        opacity: 1,
        color: 'red',
        fillOpacity: 0.7,
      });
      layer.bindPopup(`Power Outage!`);
    } else {
      const consumption = feature.properties['amount'];
      console.log(feature.properties);
      console.log('CONSUMPTION', consumption);
      let colour = getColorBasedOnConsumption(consumption);
      layer.setStyle({
        fillColor: colour,
        weight: 1,
        opacity: 1,
        color: 'black',
        fillOpacity: 0.7,
      });
    }
  };

  return (
    <MapContainer
      className={props.className}
      zoom={10}
      scrollWheelZoom={true}
      bounds={bounds}
      center={new LatLng(-37.0483, 143.7354)}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {victorianSuburbs && (
        <GeoJSON
          data={victorianSuburbs}
          onEachFeature={onEachFeature}
        />
      )}
      {powerOutageData.map((coord, index) => (
        <Marker
          key={index}
          position={coord.latLng}
          icon={OutageIcon}
        >
          <Popup>
            <div>
              <p>Power Outage!</p>
              <a href={`/main/userDashboard/${coord.id}`}>
                View Consumer Details
              </a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
