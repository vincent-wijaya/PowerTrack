"use client"
import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import { useMapEvents } from 'react-leaflet/hooks';
import { GreaterVictoria } from '../../public/data/greater-victoria';
import  fetchEnergyConsumption from '../api/energyConsumption';
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import { LatLngBounds, map } from 'leaflet';
import { Feature, FeatureCollection } from 'geojson';
  

interface EnergyData {
    suburb_id: number;
    amount: number;
    date: string; 
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
        },
    });
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
    const [victorianSuburbs, setVictorianSuburbs] = useState<FeatureCollection<any, any>>({
        type: "FeatureCollection",
        features: []
    });

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

                    const geoJSONPromises = body.energy.map(async (item) => {
                        const response = await fetch(`/data/suburbs/${item.suburb_id}.json`);
                        if (!response.ok) {
                            throw new Error(`Failed to fetch GeoJSON for suburb_id: ${item.suburb_id}`);
                        }
                        const geoJSON: Feature = await response.json();
                        return { geoJSON, amount: item.amount };
                    });

                    const geoJSONResults = await Promise.all(geoJSONPromises);
                    
                    const features = geoJSONResults.map(result => {
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
                    }

                    setVictorianSuburbs(featureCollection)
                    console.log("Vic suburbs", victorianSuburbs)

                } else {
                    console.error('Failed to fetch data:', result);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
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
            <MapContainer style={{height:'100%'}} scrollWheelZoom={true} bounds={bounds}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    
                />
                <MyComponent zoomLevel={zoomLevel} setZoomLevel={setZoomLevel}/>
                <GeoJSON
                    key = {geoJSONKey}
                    data={zoomLevel <= 7 ? GreaterVictoria : victorianSuburbs} // Conditionally set data based on zoom level
                    onEachFeature={(feature, layer: any) => {
                        const energyData = feature.properties["amount"];
                        const suburbName = feature.properties["name"]
                        if (energyData) {
                            const fillColor = getColorBasedOnConsumption(energyData);
                            layer.setStyle({
                                fillColor: fillColor,
                                weight: 1,
                                opacity: 1,
                                color: fillColor,
                                fillOpacity: 0.7,
                            });
    
                            // Add popup with amount value
                            if (energyData > 0){
                                layer.bindPopup(`<a href="regionalDashboard/${suburbName}">${suburbName}</a> <br>Energy: ${energyData}`);
                            } else {
                                layer.bindPopup(`<a href="regionalDashboard/${suburbName}">${suburbName}</a> <br>Power Outage!`)
                            }
                        } else {
                            layer.setStyle({
                                fillColor: 'black',
                                weight: 1,
                                opacity: 1,
                                color: 'black',
                                fillOpacity: 0.7,
                            });
    
                            // Add popup with default message
                            layer.bindPopup(`Area: ${suburbName} <br>No energy data available`);
                            }
                        }
                    }
                />              
            </MapContainer>
    )
}