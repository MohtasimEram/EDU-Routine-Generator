from http.server import HTTPServer, SimpleHTTPRequestHandler
import sys
import os

# Ensure we can import from the api folder
sys.path.append(os.getcwd())

# Import the handler from your backend script
from api.upload import handler as VercelHandler

class LocalTestingHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        # If the browser tries to upload to the API...
        if self.path == '/api/upload':
            # ...we hand the request over to your Vercel Backend script!
            # This runs the logic inside api/upload.py exactly as Vercel would.
            VercelHandler(self.request, self.client_address, self.server)
            return
        
        # Otherwise, handle normal things (like 404 errors)
        super().do_POST()

# Start the Simulation Server
PORT = 8000
print(f"--- LOCAL TESTING SERVER RUNNING ---")
print(f"1. Go to: http://localhost:{PORT}/admin.html")
print(f"2. Upload your file.")
print(f"3. Check: http://localhost:{PORT}/index.html")
print(f"------------------------------------")

httpd = HTTPServer(('localhost', PORT), LocalTestingHandler)
httpd.serve_forever()