"use client"
import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import { useMapEvents } from 'react-leaflet/hooks';
import { VictorianSuburbs } from '../data/victorian-suburbs';
import { GreaterVictoria } from '@/data/greater-victoria';
import  fetchEnergyConsumption from '../api/energyConsumption';
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import { LatLngBounds } from 'leaflet';
  

interface EnergyData {
    suburb_id: number;
    amount: number;
    date: string; // or Date if you want to handle it as a Date object
  }
  
  interface DataItem {
    energy: EnergyData[];
  }

interface MyComponentProps {
    zoomLevel: number;
    setZoomLevel: (zoom: number) => void
}

function MyComponent(props: MyComponentProps) {
    const { zoomLevel, setZoomLevel } = props;
    const mapEvents = useMapEvents({
        zoomend: () => {
            let newZoomValue = mapEvents.getZoom();
            setZoomLevel(newZoomValue)
            console.log(zoomLevel)
        },
    });

    console.log(zoomLevel);

    return null
}

function getColorBasedOnConsumption(consumption: number | undefined): string {
    if (consumption == null) {
        return 'black'
    }

    const minConsumption = 0; // Minimum possible consumption value
    const maxConsumption = 1000; // Maximum possible consumption value

    // Clamp consumption value between min and max
    const clampedConsumption = Math.max(minConsumption, Math.min(consumption, maxConsumption));

    // Calculate the interpolation factor (0 to 1)
    const factor = (clampedConsumption - minConsumption) / (maxConsumption - minConsumption);

    // Interpolate between blue and red
    const red = Math.round(255 * factor);
    const blue = Math.round(255 * (1 - factor));
    
    return `rgb(${red}, 0, ${blue})`;
}


export default function Map() {    
    const [data, setData] = useState<DataItem>({ energy: [] });
    const [geoJSONKey, setGeoJSONKey] = useState(0); // Add key state
    const [zoomLevel, setZoomLevel] = useState(5)
    const bounds = new LatLngBounds(
        { lat: -37.5, lng: 140 }, // Southwest corner
        { lat: -39, lng: 148 } // Northeast corner
    );

    useEffect(() => {
        const fetchData = async () => {
            try {
                const result = await fetchEnergyConsumption();
                if (result) {
                    const body = result as DataItem;
                    setData(body);
                } else {
                    console.error('Failed to fetch data:', result);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        fetchData();

        const intervalId = setInterval(fetchData, 5);

        return () => clearInterval(intervalId);
    }, [data]);

    useEffect(() => {
        setGeoJSONKey((prevKey) => prevKey + 1);
    }, [data]);

    return (
            <MapContainer style={{height:'100%'}} scrollWheelZoom={true} bounds={bounds}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    
                />
                <MyComponent zoomLevel={zoomLevel} setZoomLevel={setZoomLevel}/>
                <GeoJSON
                    key = {geoJSONKey}
                    data={zoomLevel <= 7 ? GreaterVictoria : VictorianSuburbs}
                    onEachFeature={async (feature, layer: any) => {
                        // use suburb name to fetch energy consumption data
                        const suburbId = feature.properties["loc_pid"];
                        const energyData = data.energy.find((item) => `VIC${item.suburb_id}` === suburbId);
                        const energyConsumption = energyData?.amount
                        const color = getColorBasedOnConsumption(energyConsumption)

                        if (energyConsumption !== undefined) {
                            layer.setStyle({
                                fillColor: color,
                                weight: 1,
                                opacity: 1,
                                color: color,
                                fillOpacity: 0.7,
                            });
                        } else {
                            layer.setStyle({
                                fillColor: color,
                                weight: 1,
                                opacity: 1,
                                color: color,
                                fillOpacity: 0.7,
                            });
                        }
                    }}
                />              
            </MapContainer>
    )
}