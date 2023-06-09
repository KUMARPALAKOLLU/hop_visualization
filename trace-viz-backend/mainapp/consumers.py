import asyncio
import platform
import re
import subprocess
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from threading import Thread
from .locations import get_location
from django.core.cache import cache

class TracerouteConsumer(AsyncJsonWebsocketConsumer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.proc = None
        self.locations = []
        self.ip_dict = {}

    async def connect(self):
        await self.accept()
        print("Connected (in consumer)")

    async def receive_json(self, content):
        print(f"Received message: {content}")
        hostname = content.get('hostname')
        selected = content.get('selected')
        if hostname:
            print(f"Running traceroute for hostname: {hostname}")
            timeout = 10

            # Get the current event loop
            loop = asyncio.get_running_loop()
            
            # Start a new thread that will run the traceroute command
            thread = Thread(target=self.traceroute, args=(hostname, timeout, loop))
            thread.start()

    def traceroute(self, hostname, timeout, loop):        
        self.proc = subprocess.Popen(
            ["tracert" if platform.system() == 'Windows' else "traceroute", "-w", str(timeout), hostname],
            stdout=subprocess.PIPE,
            text=True,
        )
        c = 0
        # Read the command output line by line
        for line in self.proc.stdout:
            print("Line: ", line)

            if "Unable to resolve target system name" in line:
                # Send the error message asynchronously to the client                
                error_msg = {"status": "error", "message": line}
                asyncio.run_coroutine_threadsafe(self.send_json(error_msg), loop)
                # Call the disconnect method
                asyncio.run_coroutine_threadsafe(self.disconnect(1000), loop)
                return
        
            ip_pattern = r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}"
            ip_addresses = re.findall(ip_pattern, line)
            if c <3:
                c+=1
                ip_addresses=[]
            # for ip in ip_addresses:
            if len(ip_addresses) > 0 and self.ip_dict.get(ip_addresses[0]) is None:
                # Get the location information for this IP
                ip_address = ip_addresses[0]
                self.ip_dict[ip_address] = True # mark as visited
                location_info = get_location(ip_address)     

                self.locations.append([
                    location_info[1],  # latitude
                    location_info[2],  # longitude
                    location_info[0],  # ip
                    location_info[3],  # city
                    location_info[4],  # state
                    location_info[5]   # country
                ])

                location_dict = {
                    "ip": location_info[0],
                    "latitude": location_info[1],
                    "longitude": location_info[2],
                    "city": location_info[3],
                    "state": location_info[4],
                    "country": location_info[5],
                    "country_flag": location_info[6]
                }

                # Send the location information asynchronously to the client
                future = asyncio.run_coroutine_threadsafe(self.send_json(location_dict), loop)
                # Block until the future completes
                future.result()

        # Store the locations into the cache so that can be used in views.py
        cache.set('traceroute_locations', self.locations, 300)  # Store for 5 minutes
        self.locations = [] # stored in cache, so clear it
        self.ip_dict.clear() # so clear dict

        # Send a final message indicating the end of traceroute
        final_msg = {"status": "finished"}
        asyncio.run_coroutine_threadsafe(self.send_json(final_msg), loop)

    async def send_json(self, content, close=False):
        # Check for the final message
        if content == {"status": "finished"}:
            # Close the connection
            await self.close()
        else:
            # Otherwise, just send the message as usual
            await super().send_json(content, close)

    async def disconnect(self, close_code):
        # Called when a WebSocket connection is closed.
        # If there is a running traceroute, terminate it
        print("Disconnect called")
        if self.proc:
            self.proc.terminate()
            self.proc = None