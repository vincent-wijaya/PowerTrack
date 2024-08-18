// fetchReports.ts
export default async function fetchReports() {
    // Simulated data for demonstration purposes
    const reports = [
      {
        id: 1,
        start_date: "2024-04-17T09:06:41Z",
        end_date: "2024-04-17T09:06:41Z",
        for: {
          suburb_id: 1,
          consumer_id: 1,
        },
      },
      {
        id: 2,
        start_date: "2024-05-17T09:06:41Z",
        end_date: "2024-05-17T09:06:41Z",
        for: {
          suburb_id: 2,
          consumer_id: 3,
        },
      },
      // Add more reports if needed
    ];
  
    await new Promise((resolve) => setTimeout(resolve, 3000)); // Simulating a delay of 3 seconds
  
    return reports
  }