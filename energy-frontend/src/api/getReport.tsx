export default async function fetchReport(id: number) {
    // reportData.ts
    const reportData = {
        id: 1,
        start_date: "2024-03-17T09:06:41Z",
        end_date: "2024-04-17T09:06:41Z",
        for: {
        suburb_id: 1,
        consumer_id: null
        },
        energy: [
            {
                start_date: "2024-04-16T09:06:41Z",
                end_date: "2024-04-17T09:06:41Z",
                consumption: 123.45,
                generation: 150.12
            }
            ],
        profit: [
            {
                date: "2024-04-16T09:06:41Z",
                spot_price: 10,
                selling_price: 10
            }
            ],
        sources: [
            {
                category: "Fossil Fuels",
                renewable: false,
                percentage: 0.1033,
                count: 148
            },
            {
                category: "Renewable",
                renewable: true,
                percentage: 0.0419,
                count: 67
            }
        ]
    };
  
    await new Promise((resolve) => setTimeout(resolve, 100)); // Simulating a delay of 3 seconds

    // Return the report if the id matches, otherwise return null
    return reportData.id === id ? reportData : null;
}
