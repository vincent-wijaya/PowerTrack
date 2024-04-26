export default async function fetchEnergyConsumption() {
    const dummyData = {
        'HAWTHORN': 5000,
    }
    await new Promise((resolve) => setTimeout(resolve, 1)); // Simulating a delay of 1 second
    return dummyData

}