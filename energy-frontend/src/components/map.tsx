'use client';
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from 'react-leaflet';
import { LatLng, LatLngBounds } from 'leaflet';
import { useRouter } from 'next/navigation';
import { OutageIcon } from './icons/outageIcon';
import useSWR from 'swr';
import { POLLING_RATE } from '@/config';
import { fetcher } from '@/utils';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import { Feature, FeatureCollection } from 'geojson'; // Ensure correct import for geojson types
import Legend from './mapLegend';

type MapItem = {
  suburb_id: number;
  consumption: number;
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
  const maxConsumption = 2000;

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
    FeatureCollection<any>
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
            console.log('item', item);
            return { geoJSON: feature, amount: item.consumption };
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

        const allFeatures = [...consumptionFeatures];

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

  const useOnEachFeature = (feature: Feature<any>, layer: any) => {
    const consumptionAmount = feature.properties?.amount;
    const color = getColorBasedOnConsumption(consumptionAmount);
    layer.setStyle({
      fillColor: color,
      weight: 1,
      opacity: 1,
      color: color,
      fillOpacity: 0.7,
    });
    layer.bindPopup(
      `<div>
           <p>Suburb: ${feature.properties?.name}</p>
           <p>Consumption (kW): ${feature.properties?.amount}</p>
         </div>`
    );

    layer.on('mouseover', () => {
      layer.openPopup();
    });

    layer.on('mouseout', () => {
      layer.closePopup();
    });

    layer.on('click', () => {
      const suburbId = feature.properties?.id as string;
      handleSuburbClick(suburbId);
    });
  };

  return (
    <div>
      <MapContainer
        className={props.className}
        zoom={10}
        scrollWheelZoom={true}
        bounds={bounds}
        center={new LatLng(-37.8124, 144.9623)}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {!victorianSuburbs.features.length ? (
          <div>Loading...</div>
        ) : (
          <>
            <GeoJSON
              data={victorianSuburbs}
              onEachFeature={useOnEachFeature}
            />
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
          </>
        )}
      </MapContainer>
      <Legend />
    </div>
  );
}
