const axios = require('axios');

/**
 * Reverse Geocoding: Get address from Latitude and Longitude
 */
const reverseGeocode = async (lat, lng) => {
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        format: 'jsonv2',
        lat,
        lon: lng,
        addressdetails: 1
      },
      headers: {
        'User-Agent': 'KeevaApp/1.0'
      }
    });

    if (response.data && response.data.address) {
      const addr = response.data.address;
      return {
        houseNo: addr.house_number || '',
        street: addr.road || addr.suburb || '',
        landmark: addr.neighbourhood || '',
        city: addr.city || addr.town || addr.village || addr.county || '',
        state: addr.state || '',
        pincode: addr.postcode || ''
      };
    }
    return null;
  } catch (error) {
    console.error('Reverse geocoding error:', error.message);
    return null;
  }
};

/**
 * Forward Geocoding: Get Latitude and Longitude from Address string
 */
const forwardGeocode = async (addressString) => {
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: addressString,
        format: 'jsonv2',
        limit: 1
      },
      headers: {
        'User-Agent': 'KeevaApp/1.0'
      }
    });

    if (response.data && response.data.length > 0) {
      return {
        latitude: parseFloat(response.data[0].lat),
        longitude: parseFloat(response.data[0].lon)
      };
    }
    return null;
  } catch (error) {
    console.error('Forward geocoding error:', error.message);
    return null;
  }
};

module.exports = { reverseGeocode, forwardGeocode };
