from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import httpx
import io
from PIL import Image
from pyzbar.pyzbar import decode
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="EcoInsight API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OFF_BASE_URL = "https://world.openfoodfacts.org/api/v2/product/"
USER_AGENT = os.environ.get("USER_AGENT", "EcoInsight/1.0 (contact@ecoinsight.app)")

# Carbon footprint thresholds (kg CO2e per unit)
CARBON_THRESHOLD = 2.0

class Recommendation(BaseModel):
    icon: str
    text: str
    priority: str

class ProductResponse(BaseModel):
    status: str
    gtin: Optional[str] = None
    name: Optional[str] = None
    brand: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    ingredients_text: Optional[str] = None
    nutri_score: Optional[str] = None
    eco_score: Optional[str] = None
    carbon_footprint: Optional[float] = None
    carbon_footprint_unit: Optional[str] = None
    is_high_carbon: bool = False
    recommendations: List[Recommendation] = []
    alternatives: List[dict] = []
    source: Optional[str] = None
    message: Optional[str] = None


def extract_gtin_from_image(image_data: bytes) -> Optional[str]:
    """Extract barcode from image using pyzbar."""
    try:
        img = Image.open(io.BytesIO(image_data))
        barcodes = decode(img)
        if not barcodes:
            return None
        gtin = barcodes[0].data.decode('utf-8')
        if gtin.isdigit() and len(gtin) in [8, 12, 13, 14]:
            return gtin
        return None
    except Exception as e:
        print(f"Barcode decode error: {e}")
        return None


def get_eco_score_value(eco_score: str) -> int:
    """Convert eco score grade to numeric value."""
    scores = {'a': 95, 'b': 80, 'c': 65, 'd': 45, 'e': 20}
    return scores.get(eco_score.lower() if eco_score else '', 50)


def generate_recommendations(product_data: dict, carbon_footprint: float) -> List[Recommendation]:
    """Generate sustainability recommendations based on product data."""
    recommendations = []
    eco_score = product_data.get('ecoscore_grade', '')
    nutri_score = product_data.get('nutriscore_grade', '')
    
    # High carbon footprint recommendations
    if carbon_footprint and carbon_footprint > CARBON_THRESHOLD:
        recommendations.append(Recommendation(
            icon="🌍",
            text=f"High carbon footprint ({carbon_footprint:.2f} kg CO2e). Consider eco-friendly alternatives below.",
            priority="high"
        ))
    
    # Eco score based recommendations
    if eco_score in ['d', 'e']:
        recommendations.append(Recommendation(
            icon="🌱",
            text="Low environmental score - look for products with better eco ratings",
            priority="high"
        ))
    elif eco_score in ['a', 'b']:
        recommendations.append(Recommendation(
            icon="✅",
            text="Good environmental score! This product has lower environmental impact",
            priority="low"
        ))
    
    # Nutrition recommendations
    if nutri_score in ['d', 'e']:
        recommendations.append(Recommendation(
            icon="❤️",
            text=f"Nutrition score is {nutri_score.upper()} - consider healthier options",
            priority="medium"
        ))
    
    # Packaging recommendations
    packaging = product_data.get('packaging_tags', [])
    if any('plastic' in p.lower() for p in packaging):
        recommendations.append(Recommendation(
            icon="♻️",
            text="Contains plastic packaging - recycle properly or choose alternatives with less plastic",
            priority="medium"
        ))
    
    if not recommendations:
        recommendations.append(Recommendation(
            icon="✅",
            text="This product has acceptable sustainability metrics",
            priority="low"
        ))
    
    return recommendations


async def fetch_alternatives(category: str, current_eco_score: str) -> List[dict]:
    """Fetch alternative products with better eco scores from the same category."""
    if not category:
        return []
    
    try:
        # Search for better alternatives in the same category
        search_url = f"https://world.openfoodfacts.org/cgi/search.pl"
        params = {
            "action": "process",
            "tagtype_0": "categories",
            "tag_contains_0": "contains",
            "tag_0": category.split(',')[0].strip(),
            "sort_by": "ecoscore_score",
            "page_size": 5,
            "json": 1
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                search_url,
                params=params,
                headers={"User-Agent": USER_AGENT},
                timeout=10.0
            )
            data = response.json()
        
        alternatives = []
        current_score = get_eco_score_value(current_eco_score)
        
        for product in data.get('products', [])[:5]:
            alt_eco = product.get('ecoscore_grade', '')
            if get_eco_score_value(alt_eco) > current_score:
                alternatives.append({
                    "name": product.get('product_name', 'Unknown'),
                    "brand": product.get('brands', 'Unknown'),
                    "eco_score": alt_eco,
                    "image_url": product.get('image_front_small_url'),
                    "gtin": product.get('code')
                })
        
        return alternatives[:3]
    except Exception as e:
        print(f"Error fetching alternatives: {e}")
        return []


@app.get("/")
async def root():
    return {"message": "EcoInsight API is running", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.post("/api/scan", response_model=ProductResponse)
async def scan_product(image: UploadFile = File(...)):
    """Scan a product barcode image and return sustainability data."""
    
    # Read and validate image
    image_data = await image.read()
    if not image_data:
        raise HTTPException(status_code=400, detail="Empty image file")
    
    # Extract barcode
    gtin = extract_gtin_from_image(image_data)
    if not gtin:
        return ProductResponse(
            status="not_found",
            message="No barcode detected. Please ensure the barcode is clearly visible."
        )
    
    # Fetch product data from Open Food Facts
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{OFF_BASE_URL}{gtin}",
                headers={"User-Agent": USER_AGENT},
                timeout=10.0
            )
            data = response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch product data")
    
    if not data.get('product') or data.get('status') == 0:
        return ProductResponse(
            status="not_found",
            gtin=gtin,
            message=f"Product with barcode {gtin} not found in database."
        )
    
    product = data['product']
    
    # Extract carbon footprint
    carbon_footprint = None
    carbon_unit = None
    ecoscore_data = product.get('ecoscore_data', {})
    if ecoscore_data:
        agribalyse = ecoscore_data.get('agribalyse', {})
        carbon_footprint = agribalyse.get('co2_total')
        carbon_unit = "kg CO2e/kg"
    
    is_high_carbon = carbon_footprint is not None and carbon_footprint > CARBON_THRESHOLD
    
    # Generate recommendations
    recommendations = generate_recommendations(product, carbon_footprint or 0)
    
    # Fetch alternatives if high carbon
    alternatives = []
    if is_high_carbon:
        alternatives = await fetch_alternatives(
            product.get('categories'),
            product.get('ecoscore_grade', '')
        )
    
    return ProductResponse(
        status="success",
        gtin=gtin,
        name=product.get('product_name') or product.get('product_name_en', 'Unknown Product'),
        brand=product.get('brands', 'Unknown Brand'),
        image_url=product.get('image_front_url'),
        category=product.get('categories'),
        ingredients_text=product.get('ingredients_text_en'),
        nutri_score=product.get('nutriscore_grade'),
        eco_score=product.get('ecoscore_grade'),
        carbon_footprint=carbon_footprint,
        carbon_footprint_unit=carbon_unit,
        is_high_carbon=is_high_carbon,
        recommendations=recommendations,
        alternatives=alternatives,
        source="OpenFoodFacts"
    )


@app.get("/api/product/{gtin}", response_model=ProductResponse)
async def get_product(gtin: str):
    """Get product data by GTIN/barcode number."""
    
    if not gtin.isdigit() or len(gtin) not in [8, 12, 13, 14]:
        raise HTTPException(status_code=400, detail="Invalid barcode format")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{OFF_BASE_URL}{gtin}",
                headers={"User-Agent": USER_AGENT},
                timeout=10.0
            )
            data = response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch product data")
    
    if not data.get('product') or data.get('status') == 0:
        return ProductResponse(
            status="not_found",
            gtin=gtin,
            message=f"Product with barcode {gtin} not found."
        )
    
    product = data['product']
    
    carbon_footprint = None
    ecoscore_data = product.get('ecoscore_data', {})
    if ecoscore_data:
        agribalyse = ecoscore_data.get('agribalyse', {})
        carbon_footprint = agribalyse.get('co2_total')
    
    is_high_carbon = carbon_footprint is not None and carbon_footprint > CARBON_THRESHOLD
    recommendations = generate_recommendations(product, carbon_footprint or 0)
    
    alternatives = []
    if is_high_carbon:
        alternatives = await fetch_alternatives(
            product.get('categories'),
            product.get('ecoscore_grade', '')
        )
    
    return ProductResponse(
        status="success",
        gtin=gtin,
        name=product.get('product_name') or product.get('product_name_en', 'Unknown Product'),
        brand=product.get('brands', 'Unknown Brand'),
        image_url=product.get('image_front_url'),
        category=product.get('categories'),
        ingredients_text=product.get('ingredients_text_en'),
        nutri_score=product.get('nutriscore_grade'),
        eco_score=product.get('ecoscore_grade'),
        carbon_footprint=carbon_footprint,
        carbon_footprint_unit="kg CO2e/kg" if carbon_footprint else None,
        is_high_carbon=is_high_carbon,
        recommendations=recommendations,
        alternatives=alternatives,
        source="OpenFoodFacts"
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

