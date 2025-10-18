from flask import Flask, request, jsonify
import requests
import os
from dotenv import load_dotenv
import io
from pyzbar.pyzbar import decode
from PIL import Image
from flask_cors import CORS

# --- Configuration ---
# Load environment variables (like USER_AGENT) from a .env file
load_dotenv()

app = Flask(__name__)
CORS(app)  # allow requests from frontend
# Max file size set to 5MB
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024

# Open Food Facts API configuration
OFF_BASE_URL = "https://world.openfoodfacts.org/api/v2/product/"
# User-Agent is MANDATORY for Open Food Facts
USER_AGENT = os.environ.get("USER_AGENT", "BarcodeExtractorApp/1.0 (dev@yourapp.com)")


def extract_gtin_from_image(image_data):
   """
   Decodes the barcode (GTIN) from raw binary image data using pyzbar/Pillow.
   """
   try:
       # Read the binary data from the stream into a Pillow Image object
       img = Image.open(io.BytesIO(image_data))
      
       # Decode the barcode(s)
       barcodes = decode(img)
      
       if not barcodes:
           return None
      
       # Extract and decode the GTIN from the first detected barcode
       gtin = barcodes[0].data.decode('utf-8')
      
       # Simple GTIN validation
       if gtin.isdigit() and len(gtin) in [8, 12, 13, 14]:
           return gtin
      
       return None
      
   except Exception as e:
       # Log the error (e.g., if the file format is unreadable by PIL)
       print(f"Error during barcode decoding: {e}")
       return None

@app.route('/', methods=['GET'])
def home():
   return "Barcode Extraction and Product Lookup Service is Running"

@app.route('/extract_and_lookup', methods=['POST'])
def handle_image_upload():
   # 1. Input Validation and File Handling
   if 'image' not in request.files:
       return jsonify({
           "status": "error",
           "message": "No image file provided. Please ensure the form key is 'image'."
       }), 400
  
   image_file = request.files['image']
   image_data = image_file.read()
  
   if not image_data:
       return jsonify({"status": "error", "message": "The uploaded image file is empty."}), 400


   # 2. Barcode Extraction
   gtin = extract_gtin_from_image(image_data)
  
   if not gtin:
       # This handles the scenario where the image was sent, but no barcode was decoded
       return jsonify({
           "status": "not_found",
           "message": "Barcode not detected or is unreadable."
       }), 404


   # 3. External Data Fetcher (Open Food Facts)
   try:
       off_url = f"{OFF_BASE_URL}{gtin}"
      
       # Making the external API request
       response = requests.get(
           off_url,
           headers={"User-Agent": USER_AGENT},
           timeout=5
       )
       response.raise_for_status()
       off_data = response.json()


       # 4. Process API Response (Handle missing products)
       if not off_data.get('product') or off_data.get('status') == 0:
           return jsonify({
               "status": "not_found",
               "message": f"Barcode {gtin} found, but product details are missing from the open database."
           }), 404


       # 5. Standardize and Return Data
       product = off_data['product']
      
       # This standardized JSON is the contract for your team's backend/LLM
       return jsonify({
           "status": "success",
           "gtin": gtin,
           "name": product.get('product_name') or product.get('product_name_en', 'N/A'),
           "brand": product.get('brands') or 'N/A',
           "image_url": product.get('image_front_url'),
           "category": product.get('categories'),
           "ingredients_text": product.get('ingredients_text_en'),
           # Extract RAW scores for the LLM/Backend to process
           "nutri_score": product.get('nutriscore_grade', 'N/A'),
           "eco_score": product.get('ecoscore_grade', 'N/A'),
           "source": "OpenFoodFacts"
       })


   except requests.exceptions.RequestException as e:
       print(f"Error calling OFF API: {e}")
       return jsonify({"status": "error", "message": "Failed to connect to external data source."}), 500


if __name__ == '__main__':
   # For testing: The script runs on localhost port 8000
   # Remember to install all dependencies: pip install Flask requests pyzbar Pillow python-dotenv
   app.run(debug=True, port=8000)