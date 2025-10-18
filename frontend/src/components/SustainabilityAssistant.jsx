import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, Camera, Leaf, TrendingDown, AlertCircle, Check } from 'lucide-react';

const SustainabilityAssistant = () => {
  const [product, setProduct] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mock product data
  const mockProducts = {
    'coca-cola': {
      name: 'Coca-Cola Classic',
      brand: 'The Coca-Cola Company',
      category: 'Beverages',
      carbonFootprint: '0.48 kg CO2e per 330ml',
      sustainabilityScore: 62,
      details: {
        packaging: 'Aluminum can (recyclable)',
        recycledContent: '50% recycled aluminum',
        waterUsage: '2.5L per product',
        manufacturing: 'Standard carbonation process'
      },
      recommendations: [
        { icon: '♻️', text: 'Recycle the aluminum can - it saves 95% energy vs. new production' },
        { icon: '🌍', text: 'Choose glass bottles for lower carbon footprint' },
        { icon: '💧', text: 'Combo tip: Buy larger sizes to reduce packaging waste' }
      ]
    },
    'apple': {
      name: 'Apple iPhone 15',
      brand: 'Apple Inc.',
      category: 'Electronics',
      carbonFootprint: '57 kg CO2e (lifecycle)',
      sustainabilityScore: 78,
      details: {
        packaging: 'Recycled aluminum & paper',
        recycledContent: '100% renewable energy manufacturing',
        durability: '5-7 years expected lifespan',
        repairability: 'High - parts available'
      },
      recommendations: [
        { icon: '🔄', text: 'Use trade-in program to recycle your old device' },
        { icon: '🔋', text: 'Charge overnight with renewable energy if available' },
        { icon: '♻️', text: 'Apple recycles 98% of materials from returned devices' }
      ]
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      sendImageToBackend(file);
    }
  };

  const handleCameraScan = () => {
    // Simulate taking a photo - in production, use device camera API
    // For now, trigger file upload
    fileInputRef.current?.click();
  };

  // Helper function to convert eco_score to numeric value
  const getEcoScore = (ecoScore) => {
    const scoreMap = {
      'a': 95,
      'b': 80,
      'c': 65,
      'd': 45,
      'e': 20,
      'not-applicable': 50
    };
    return scoreMap[ecoScore?.toLowerCase()] || 50;
  };

  // Helper function to generate recommendations based on product data
  const generateRecommendations = (data) => {
    const recommendations = [];

    if (data.eco_score === 'not-applicable') {
      recommendations.push({
        icon: '⚠️',
        text: 'Eco score not available for this product'
      });
    } else if (data.eco_score === 'e' || data.eco_score === 'd') {
      recommendations.push({
        icon: '🌍',
        text: 'Consider choosing products with better environmental ratings'
      });
    }

    if (data.nutri_score && (data.nutri_score === 'd' || data.nutri_score === 'e')) {
      recommendations.push({
        icon: '❤️',
        text: `Nutrition score is ${data.nutri_score.toUpperCase()} - consider healthier alternatives`
      });
    }

    if (data.ingredients_text && data.ingredients_text.toLowerCase().includes('aspartame')) {
      recommendations.push({
        icon: '🔬',
        text: 'Contains artificial sweeteners - moderation recommended'
      });
    }

    recommendations.push({
      icon: '♻️',
      text: 'Always check packaging for recycling instructions'
    });

    return recommendations.length > 0 ? recommendations : [
      { icon: '✅', text: 'This product has good sustainability metrics' }
    ];
  };

  const sendImageToBackend = async (file) => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('http://localhost:8000/extract_and_lookup', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Handle the response from Flask/OpenFoodFacts
      const productData = {
        name: data.name || 'Unknown Product',
        brand: data.brand || 'Unknown Brand',
        category: data.category || 'Product',
        carbonFootprint: data.carbon_footprint || 'Not available',
        sustainabilityScore: data.eco_score === 'not-applicable' ? 50 : getEcoScore(data.eco_score),
        nutriScore: data.nutri_score || 'N/A',
        gtin: data.gtin || 'N/A',
        image_url: data.image_url || null,
        details: {
          ingredients: data.ingredients_text || 'Not available',
          nutriScore: data.nutri_score ? `Score: ${data.nutri_score.toUpperCase()}` : 'N/A',
          ecoScore: data.eco_score || 'Not applicable',
          source: data.source || 'Unknown'
        },
        recommendations: generateRecommendations(data)
      };

      setProduct(productData);
      setMessages([
        {
          type: 'assistant',
          text: `Great! I found **${productData.name}**. Here's what I know about its sustainability. What would you like to know more about?`
        }
      ]);
      setIsLoading(false);
    } catch (error) {
      console.error('Error uploading image:', error);
      setIsLoading(false);
      setMessages([
        {
          type: 'assistant',
          text: 'Sorry, I encountered an error analyzing the product. Please try again.'
        }
      ]);
    }
  };

  const handleSendMessage = () => {
    if (!inputValue.trim() || !product) return;

    setMessages((prev) => [...prev, { type: 'user', text: inputValue }]);
    setInputValue('');
    setIsLoading(true);

    setTimeout(() => {
      const responses = [
        `That's a great question! For **${product?.name}**, I'd recommend focusing on recycling the packaging after use. ${product?.recommendations?.[0]?.text || ''}`,
        `The sustainability score of **${product?.sustainabilityScore}/100** reflects its ${product?.details?.packaging}. You can improve by ${product?.recommendations?.[1]?.text || 'reducing consumption'}.`,
        `Did you know? ${product?.name}'s carbon footprint is **${product?.carbonFootprint}**. The best way to reduce impact is to ${product?.recommendations?.[2]?.text || 'extend product lifespan'}.`
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      setMessages((prev) => [...prev, { type: 'assistant', text: randomResponse }]);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-50 to-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-600 rounded-full shadow-lg">
              <Leaf className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="font-black text-3xl text-gray-900">EcoInsight</h1>
              <p className="text-sm text-emerald-600 font-semibold">Sustainability Assistant</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Split View */}
      <div className="flex-1 w-full px-4 py-6 flex items-center justify-center">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Side - Upload/Scan Section */}
        <div className="flex flex-col">
          <div className="bg-white rounded-2xl p-8 border-2 border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Scan or Upload</h2>
            
            <div className="space-y-4">
              {/* Upload Card */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="w-full p-12 bg-white rounded-2xl border-2 border-dashed border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50 transition-all duration-300 cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-200 transition">
                    <Upload className="w-8 h-8 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-bold text-lg text-gray-900">Upload Product Image</p>
                    <p className="text-sm text-gray-500">PNG, JPG up to 10MB</p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isLoading}
                />
              </button>

              {/* Camera Card */}
              <button
                onClick={handleCameraScan}
                disabled={isLoading}
                className="w-full p-12 bg-white rounded-2xl border-2 border-emerald-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all duration-300 cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-200 transition">
                    <Camera className="w-8 h-8 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-bold text-lg text-gray-900">Scan with Camera</p>
                    <p className="text-sm text-gray-500">Use your device camera</p>
                  </div>
                </div>
              </button>
            </div>

            {isLoading && !product && (
              <div className="mt-6 text-center">
                <div className="inline-flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-full">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-emerald-700">Analyzing product...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Product Details & Chat */}
        {product && (
          <div className="flex flex-col gap-6">
            {/* Product Summary Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="mb-4">
                <h3 className="font-bold text-lg text-gray-900">{product.name}</h3>
                <p className="text-sm text-gray-500">{product.brand}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex items-start gap-3">
                  <TrendingDown className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Carbon Footprint</p>
                    <p className="text-sm font-semibold text-gray-900">{product.carbonFootprint}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Leaf className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Sustainability Score</p>
                    <p className="text-sm font-semibold text-emerald-600">{product.sustainabilityScore}/100</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Recommendations</p>
                {product.recommendations.map((rec, idx) => (
                  <div key={idx} className="flex gap-2 text-sm text-gray-700 bg-emerald-50 p-2 rounded-lg">
                    <span className="flex-shrink-0">{rec.icon}</span>
                    <span>{rec.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chat Interface */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col flex-1 min-h-96">
              <h3 className="font-semibold text-gray-900 mb-4">Ask Questions</h3>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-xs px-4 py-3 rounded-2xl ${
                        msg.type === 'user'
                          ? 'bg-emerald-600 text-white rounded-br-none'
                          : 'bg-gray-100 text-gray-900 rounded-bl-none'
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-none">
                      <div className="flex gap-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask about sustainability..."
                  className="flex-1 px-4 py-3 bg-gray-100 rounded-full border border-gray-200 focus:border-emerald-400 focus:outline-none focus:bg-white text-sm transition"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  className="w-10 h-10 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-full flex items-center justify-center transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty State Message */}
        {!product && !isLoading && (
          <div className="flex items-center justify-center bg-white rounded-2xl p-8 border-2 border-dashed border-gray-200">
            <div className="text-center">
              <Leaf className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Scan or upload a product to get started</p>
              <p className="text-sm text-gray-400">Results will appear here</p>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default SustainabilityAssistant;