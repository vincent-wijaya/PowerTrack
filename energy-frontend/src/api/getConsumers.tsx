export default async function fetchConsumers() {
    const dummyData = { 
        "consumer": [
            {
                "suburb_id": 1,
                "suburb_name": "Hawthorn",
                "suburb_postcode": "3000",
                "consumer_id": 1,
                "address": "address",
                "high_priority": true 
            },
            {
                "suburb_id": 1,
                "suburb_name": "Hawthorn",
                "suburb_postcode": "3000",
                "consumer_id": 2,
                "address": "address",
                "high_priority": false 
            }
        ]
    }


    
    await new Promise((resolve) => setTimeout(resolve, 3000)); // Simulating a delay of 3 second
    return dummyData
}