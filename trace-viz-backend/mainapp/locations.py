import platform
import requests
# Set up API credentials
api_key = '7a2edb1673278b4cda71e3e1383ffa9c'

# Define function to get location details for a single IP
def get_location(ip):
    url = f'http://api.ipapi.com/{ip}?access_key={api_key}'
    response = requests.get(url)
    data = response.json()
    try:
        city = data['city']
        latitude = data['latitude']
        longitude = data['longitude']        
        state = data['region_name']
        country = data['country_name']
        country_flag = data['location']['country_flag']
    except KeyError as a:
        latitude, longitude, city, state, country, country_flag = 0, 0, None, None, None, None
    return (ip, latitude, longitude, city, state, country, country_flag)
