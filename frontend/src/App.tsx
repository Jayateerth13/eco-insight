import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Leaf, Upload, Camera, TrendingDown, Sparkles, 
  AlertTriangle, CheckCircle2, ArrowRight, X, Loader2, XCircle
} from 'lucide-react'

interface Recommendation {
  icon: string
  text: string
  priority: string
}

interface Alternative {
  name: string
  brand: string
  eco_score: string
  image_url?: string
  gtin: string
}

interface Product {
  status: string
  gtin?: string
  name?: string
  brand?: string
  image_url?: string
  category?: string
  nutri_score?: string
  eco_score?: string
  carbon_footprint?: number
  carbon_footprint_unit?: string
  is_high_carbon: boolean
  recommendations: Recommendation[]
  alternatives: Alternative[]
  message?: string
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function App() {
  const [product, setProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const getEcoScoreValue = (score?: string): number => {
    const scores: Record<string, number> = { a: 95, b: 80, c: 65, d: 45, e: 20 }
    return scores[score?.toLowerCase() || ''] || 50
  }

  const getEcoScoreColor = (score?: string): string => {
    const colors: Record<string, string> = {
      a: '#22c55e', b: '#84cc16', c: '#eab308', d: '#f97316', e: '#ef4444'
    }
    return colors[score?.toLowerCase() || ''] || '#9ca3af'
  }

  const scanProduct = async (file: File) => {
    setIsLoading(true)
    setError(null)
    setProduct(null)

    const formData = new FormData()
    formData.append('image', file)

    try {
      const response = await fetch(`${API_URL}/api/scan`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to scan product')
      }

      const data: Product = await response.json()
      
      if (data.status === 'not_found') {
        setError(data.message || 'Product not found')
      } else {
        setProduct(data)
      }
    } catch (err) {
      setError('Failed to connect to server. Please ensure the backend is running.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) scanProduct(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      scanProduct(file)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const resetScan = () => {
    setProduct(null)
    setError(null)
  }

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      streamRef.current = stream
      setShowCamera(true)
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      }, 100)
    } catch (err) {
      setError('Camera access denied. Please allow camera permissions.')
    }
  }

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setShowCamera(false)
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return
    
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    ctx.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' })
        closeCamera()
        scanProduct(file)
      }
    }, 'image/jpeg', 0.9)
  }

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const ecoScore = product?.eco_score
  const scoreValue = getEcoScoreValue(ecoScore)
  const scoreColor = getEcoScoreColor(ecoScore)
  const circumference = 2 * Math.PI * 45
  const strokeDashoffset = circumference - (scoreValue / 100) * circumference

  return (
    <main className="min-h-screen bg-eco-gradient">
      {/* Header */}
      <header className="sticky top-0 z-50 glass">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-forest-500 to-forest-600 rounded-xl flex items-center justify-center shadow-lg shadow-forest-500/20">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-xl text-forest-900">EcoInsight</h1>
              <p className="text-xs text-forest-600">Sustainability Assistant</p>
            </div>
          </div>
          {product && (
            <button
              onClick={resetScan}
              className="text-sm text-forest-600 hover:text-forest-800 flex items-center gap-1 transition"
            >
              <X className="w-4 h-4" /> New Scan
            </button>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {!product && !isLoading && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-xl mx-auto"
            >
              {/* Hero */}
              <div className="text-center mb-10">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.1 }}
                  className="inline-flex items-center gap-2 bg-forest-100 text-forest-700 px-4 py-2 rounded-full text-sm font-medium mb-4"
                >
                  <Sparkles className="w-4 h-4" />
                  Powered by Open Food Facts
                </motion.div>
                <h2 className="text-4xl font-bold text-forest-950 mb-3">
                  Discover Your Product's<br />
                  <span className="text-forest-600">Carbon Footprint</span>
                </h2>
                <p className="text-forest-700 text-lg">
                  Scan any product barcode to get instant sustainability insights
                </p>
              </div>

              {/* Upload Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`drop-zone relative bg-white rounded-3xl border-2 border-dashed p-12 text-center transition-all cursor-pointer hover:border-forest-400 ${
                  isDragging ? 'drag-over border-forest-500' : 'border-forest-200'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                <div className="w-20 h-20 mx-auto mb-6 bg-forest-50 rounded-2xl flex items-center justify-center">
                  <Upload className="w-10 h-10 text-forest-500" />
                </div>
                
                <p className="text-lg font-semibold text-forest-900 mb-2">
                  Drop your barcode image here
                </p>
                <p className="text-forest-600 mb-6">or click to browse files</p>
                
                <div className="flex items-center justify-center gap-4">
                  <button className="flex items-center gap-2 bg-forest-600 hover:bg-forest-700 text-white px-6 py-3 rounded-xl font-medium transition shadow-lg shadow-forest-500/20">
                    <Upload className="w-4 h-4" />
                    Upload Image
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); openCamera(); }}
                    className="flex items-center gap-2 bg-forest-100 hover:bg-forest-200 text-forest-700 px-6 py-3 rounded-xl font-medium transition"
                  >
                    <Camera className="w-4 h-4" />
                    Use Camera
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3"
                >
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700">{error}</p>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Loading */}
          {isLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="w-16 h-16 bg-forest-100 rounded-2xl flex items-center justify-center mb-4">
                <Loader2 className="w-8 h-8 text-forest-600 animate-spin" />
              </div>
              <p className="text-forest-700 font-medium">Analyzing product...</p>
            </motion.div>
          )}

          {/* Results */}
          {product && product.status === 'success' && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid lg:grid-cols-3 gap-6"
            >
              {/* Product Card */}
              <div className="lg:col-span-2 bg-white rounded-3xl p-8 shadow-sm">
                <div className="flex gap-6 mb-8">
                  {product.image_url && (
                    <div className="w-32 h-32 bg-forest-50 rounded-2xl overflow-hidden flex-shrink-0">
                      <img
                        src={product.image_url}
                        alt={product.name || 'Product'}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-forest-950 mb-1">{product.name}</h3>
                    <p className="text-forest-600 mb-4">{product.brand}</p>
                    
                    <div className="flex flex-wrap gap-3">
                      {product.nutri_score && (
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                          Nutri-Score: {product.nutri_score.toUpperCase()}
                        </span>
                      )}
                      {product.eco_score && (
                        <span 
                          className="px-3 py-1 rounded-full text-sm font-medium"
                          style={{ 
                            backgroundColor: `${scoreColor}20`, 
                            color: scoreColor 
                          }}
                        >
                          Eco-Score: {product.eco_score.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Carbon Footprint Alert */}
                {product.carbon_footprint && (
                  <div className={`rounded-2xl p-6 mb-6 ${
                    product.is_high_carbon 
                      ? 'bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200' 
                      : 'bg-gradient-to-r from-forest-50 to-emerald-50 border border-forest-200'
                  }`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        product.is_high_carbon ? 'bg-orange-100' : 'bg-forest-100'
                      }`}>
                        <TrendingDown className={`w-6 h-6 ${
                          product.is_high_carbon ? 'text-orange-600' : 'text-forest-600'
                        }`} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Carbon Footprint</p>
                        <p className="text-2xl font-bold text-forest-950">
                          {product.carbon_footprint.toFixed(2)} <span className="text-base font-normal">{product.carbon_footprint_unit}</span>
                        </p>
                      </div>
                      {product.is_high_carbon && (
                        <div className="ml-auto flex items-center gap-2 text-orange-600">
                          <AlertTriangle className="w-5 h-5" />
                          <span className="font-medium">High Impact</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                <div>
                  <h4 className="font-semibold text-forest-900 mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-forest-500" />
                    Sustainability Insights
                  </h4>
                  <div className="space-y-3">
                    {product.recommendations.map((rec, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className={`flex items-start gap-3 p-4 rounded-xl ${
                          rec.priority === 'high' 
                            ? 'bg-orange-50 border border-orange-100' 
                            : rec.priority === 'low'
                            ? 'bg-forest-50 border border-forest-100'
                            : 'bg-gray-50 border border-gray-100'
                        }`}
                      >
                        <span className="text-xl">{rec.icon}</span>
                        <p className="text-forest-800">{rec.text}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Score & Alternatives */}
              <div className="space-y-6">
                {/* Eco Score Ring */}
                <div className="bg-white rounded-3xl p-6 shadow-sm text-center">
                  <h4 className="font-semibold text-forest-900 mb-4">Environmental Score</h4>
                  <div className="relative w-32 h-32 mx-auto mb-4">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="45"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="10"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="45"
                        fill="none"
                        stroke={scoreColor}
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        className="score-ring"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl font-bold" style={{ color: scoreColor }}>
                        {ecoScore?.toUpperCase() || '?'}
                      </span>
                    </div>
                  </div>
                  <p className="text-forest-600 text-sm">
                    {scoreValue >= 80 ? 'Excellent choice!' : 
                     scoreValue >= 60 ? 'Good sustainability' :
                     scoreValue >= 40 ? 'Room for improvement' : 
                     'Consider alternatives'}
                  </p>
                </div>

                {/* Alternatives */}
                {product.alternatives.length > 0 && (
                  <div className="bg-white rounded-3xl p-6 shadow-sm">
                    <h4 className="font-semibold text-forest-900 mb-4 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-forest-500" />
                      Better Alternatives
                    </h4>
                    <div className="space-y-3">
                      {product.alternatives.map((alt, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 + idx * 0.1 }}
                          className="flex items-center gap-3 p-3 bg-forest-50 rounded-xl hover:bg-forest-100 transition cursor-pointer group"
                        >
                          {alt.image_url && (
                            <img
                              src={alt.image_url}
                              alt={alt.name}
                              className="w-10 h-10 rounded-lg object-contain bg-white"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-forest-900 truncate">{alt.name}</p>
                            <p className="text-xs text-forest-600">{alt.brand}</p>
                          </div>
                          <span 
                            className="px-2 py-1 rounded-full text-xs font-bold"
                            style={{ 
                              backgroundColor: `${getEcoScoreColor(alt.eco_score)}20`,
                              color: getEcoScoreColor(alt.eco_score)
                            }}
                          >
                            {alt.eco_score?.toUpperCase()}
                          </span>
                          <ArrowRight className="w-4 h-4 text-forest-400 group-hover:text-forest-600 transition" />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
          <div className="flex items-center justify-between p-4">
            <h3 className="text-white font-semibold">Scan Barcode</h3>
            <button onClick={closeCamera} className="text-white hover:text-gray-300">
              <XCircle className="w-8 h-8" />
            </button>
          </div>
          
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="relative w-full max-w-lg aspect-[4/3] bg-black rounded-2xl overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-32 border-2 border-white/50 rounded-lg" />
              </div>
            </div>
          </div>
          
          <div className="p-6 flex justify-center">
            <button
              onClick={capturePhoto}
              className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition"
            >
              <div className="w-16 h-16 bg-forest-500 rounded-full" />
            </button>
          </div>
          
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}
    </main>
  )
}

