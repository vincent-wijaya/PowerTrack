const request = require('supertest');
const axios = require('axios');
const app = require('../app');

jest.mock('axios', () => ({
    get: jest.fn(),
}));

// Test the example route
describe('GET /retailer/map', () => {
  it('responds with mocked data', async () => {
    axios.get.mockResolvedValue({
        data: {
            'energy': [
                {
                    'suburb': 'Clayton',
                    'consumption': 123.45,
                    'generation': 150.12
                }
            ],
            'timestamp': '2024-04-17T09:06:41Z'
        }
    });

    const response = await request(app).get('/retailer/map');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
        'energy': [
            {
                'suburb': 'Clayton',
                'consumption': 123.45,
                'generation': 150.12
            }
        ],
        'timestamp': '2024-04-17T09:06:41Z'
    });
  });
});
