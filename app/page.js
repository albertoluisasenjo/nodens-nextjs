'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// Cliente Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const BACKEND_URL = process.env.NEXT_PUBLIC_PYTHON_BACKEND_URL || 'http://localhost:8000'

export default function HomePage() {
  // =========================================================================
  // ESTADO
  // =========================================================================
  
  // Formulario
  const [origin, setOrigin] = useState('malaga-espana')
  const [destinations, setDestinations] = useState('dusseldorf-alemania\nshannon-irlanda\nmemmingen-alemania')
  const [outboundStart, setOutboundStart] = useState('')
  const [outboundEnd, setOutboundEnd] = useState('')
  const [returnStart, setReturnStart] = useState('')
  const [returnEnd, setReturnEnd] = useState('')
  const [syncDates, setSyncDates] = useState(false)
  const [patterns, setPatterns] = useState([
    { outbound: 'Fri', return: 'Sun' },
    { outbound: 'Thu', return: 'Mon' }
  ])
  const [outboundDepAfter, setOutboundDepAfter] = useState(9)
  const [outboundArrBefore, setOutboundArrBefore] = useState(16)
  const [returnDepAfter, setReturnDepAfter] = useState(13)
  const [returnArrBefore, setReturnArrBefore] = useState(21)
  const [allowStops, setAllowStops] = useState(false)
  
  // Búsqueda
  const [searching, setSearching] = useState(false)
  const [searchId, setSearchId] = useState(null)
  const [searchStatus, setSearchStatus] = useState(null)
  const [results, setResults] = useState([])
  const [error, setError] = useState(null)

  // =========================================================================
  // INICIALIZACIÓN DE FECHAS
  // =========================================================================
  
  useEffect(() => {
    const today = new Date()
    const oneMonthLater = new Date(today)
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1)
    
    const formatDate = (date) => date.toISOString().split('T')[0]
    
    setOutboundStart(formatDate(today))
    setOutboundEnd(formatDate(oneMonthLater))
    if (!syncDates) {
      setReturnStart(formatDate(today))
      setReturnEnd(formatDate(oneMonthLater))
    }
  }, [])

  useEffect(() => {
    if (syncDates) {
      setReturnStart(outboundStart)
      setReturnEnd(outboundEnd)
    }
  }, [syncDates, outboundStart, outboundEnd])

  // =========================================================================
  // POLLING PARA ACTUALIZAR ESTADO
  // =========================================================================
  
  useEffect(() => {
    if (!searchId || searchStatus === 'completed' || searchStatus === 'failed') return
    
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/search/${searchId}`)
        const data = await response.json()
        
        setSearchStatus(data.status)
        
        if (data.status === 'completed') {
          setResults(data.results || [])
          setSearching(false)
        } else if (data.status === 'failed') {
          setError('Search failed. Please try again.')
          setSearching(false)
        }
      } catch (err) {
        console.error('Error polling search status:', err)
      }
    }, 3000) // Cada 3 segundos
    
    return () => clearInterval(interval)
  }, [searchId, searchStatus])

  // =========================================================================
  // HANDLERS
  // =========================================================================
  
  const handleAddPattern = () => {
    setPatterns([...patterns, { outbound: 'Fri', return: 'Sun' }])
  }
  
  const handleRemovePattern = (index) => {
    setPatterns(patterns.filter((_, i) => i !== index))
  }
  
  const handlePatternChange = (index, field, value) => {
    const newPatterns = [...patterns]
    newPatterns[index][field] = value
    setPatterns(newPatterns)
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    setSearching(true)
    setError(null)
    setSearchId(null)
    setResults([])
    
    try {
      const requestData = {
        origin,
        destinations: destinations.split('\n').map(d => d.trim()).filter(d => d),
        outbound_start: outboundStart,
        outbound_end: outboundEnd,
        return_start: returnStart,
        return_end: returnEnd,
        patterns: patterns.map(p => ({ outbound: p.outbound, return_day: p.return })),
        outbound_times: [outboundDepAfter, 24, 0, outboundArrBefore],
        return_times: [returnDepAfter, 24, 0, returnArrBefore],
        allow_stops: allowStops
      }
      
      const response = await fetch(`${BACKEND_URL}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      })
      
      if (!response.ok) throw new Error('Failed to start search')
      
      const data = await response.json()
      setSearchId(data.search_id)
      setSearchStatus('pending')
      
    } catch (err) {
      setError(err.message)
      setSearching(false)
    }
  }

  // =========================================================================
  // RENDER HELPERS
  // =========================================================================
  
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const hours = Array.from({ length: 25 }, (_, i) => i)
  
  const groupResultsByDestination = () => {
    const grouped = {}
    results.forEach(result => {
      if (!grouped[result.destination]) {
        grouped[result.destination] = []
      }
      grouped[result.destination].push(result)
    })
    return grouped
  }
  
  const groupResultsByPattern = () => {
    const grouped = {}
    results.forEach(result => {
      if (!grouped[result.pattern]) {
        grouped[result.pattern] = []
      }
      grouped[result.pattern].push(result)
    })
    return grouped
  }
  
  const getBestOverall = () => {
    const byPattern = groupResultsByPattern()
    const best = {}
    Object.keys(byPattern).forEach(pattern => {
      const sorted = byPattern[pattern].sort((a, b) => a.total_price - b.total_price)
      if (sorted.length > 0) best[pattern] = sorted[0]
    })
    return best
  }

  // =========================================================================
  // RENDER
  // =========================================================================
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white py-8 shadow-2xl">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl font-bold mb-2">🌊 Nodens Navigator</h1>
          <p className="text-xl opacity-90">Lord of the Great Abyss - Bringing order to the chaos of flight prices</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* SIDEBAR - Formulario */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800 rounded-lg shadow-xl p-6 sticky top-4">
              <h2 className="text-2xl font-bold text-white mb-6">⚙️ Configuration</h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Origin */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    🛫 Origin City
                  </label>
                  <input
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="malaga-espana"
                  />
                  <p className="text-xs text-gray-400 mt-1">Format: ciudad-pais</p>
                </div>

                {/* Destinations */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    📍 Destinations
                  </label>
                  <textarea
                    value={destinations}
                    onChange={(e) => setDestinations(e.target.value)}
                    rows={5}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="dusseldorf-alemania&#10;shannon-irlanda"
                  />
                  <p className="text-xs text-gray-400 mt-1">One per line</p>
                </div>

                {/* Date Range */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">📅 Date Range</h3>
                  
                  <label className="flex items-center text-gray-300 mb-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncDates}
                      onChange={(e) => setSyncDates(e.target.checked)}
                      className="mr-2"
                    />
                    🔗 Same date range for return
                  </label>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Outbound from</label>
                      <input
                        type="date"
                        value={outboundStart}
                        onChange={(e) => setOutboundStart(e.target.value)}
                        className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Outbound to</label>
                      <input
                        type="date"
                        value={outboundEnd}
                        onChange={(e) => setOutboundEnd(e.target.value)}
                        className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                      />
                    </div>
                    
                    {!syncDates && (
                      <>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Return from</label>
                          <input
                            type="date"
                            value={returnStart}
                            onChange={(e) => setReturnStart(e.target.value)}
                            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Return to</label>
                          <input
                            type="date"
                            value={returnEnd}
                            onChange={(e) => setReturnEnd(e.target.value)}
                            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Day Patterns */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">📆 Day Patterns</h3>
                  
                  {patterns.map((pattern, index) => (
                    <div key={index} className="mb-3">
                      <div className="grid grid-cols-3 gap-2">
                        <select
                          value={pattern.outbound}
                          onChange={(e) => handlePatternChange(index, 'outbound', e.target.value)}
                          className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                        >
                          {dayNames.map(day => (
                            <option key={day} value={day}>{day}</option>
                          ))}
                        </select>
                        
                        <select
                          value={pattern.return}
                          onChange={(e) => handlePatternChange(index, 'return', e.target.value)}
                          className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                        >
                          {dayNames.map(day => (
                            <option key={day} value={day}>{day}</option>
                          ))}
                        </select>
                        
                        <button
                          type="button"
                          onClick={() => handleRemovePattern(index)}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm"
                        >
                          ×
                        </button>
                      </div>
                      <p className="text-center text-xs text-cyan-400 mt-1">
                        {pattern.outbound.slice(0, 3)}-{pattern.return.slice(0, 3)}
                      </p>
                    </div>
                  ))}
                  
                  <button
                    type="button"
                    onClick={handleAddPattern}
                    className="w-full py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-white text-sm"
                  >
                    ➕ Add Pattern
                  </button>
                </div>

                {/* Flight Options */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">✈️ Flight Options</h3>
                  <label className="flex items-center text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowStops}
                      onChange={(e) => setAllowStops(e.target.checked)}
                      className="mr-2"
                    />
                    Allow connections
                  </label>
                </div>

                {/* Time Preferences */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">🕐 Time Preferences</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-300 mb-2">Outbound Flight</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Departure</label>
                          <select
                            value={outboundDepAfter}
                            onChange={(e) => setOutboundDepAfter(Number(e.target.value))}
                            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                          >
                            {hours.map(h => (
                              <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">Later than</p>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Arrival</label>
                          <select
                            value={outboundArrBefore}
                            onChange={(e) => setOutboundArrBefore(Number(e.target.value))}
                            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                          >
                            {hours.map(h => (
                              <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">Earlier than</p>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-300 mb-2">Return Flight</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Departure</label>
                          <select
                            value={returnDepAfter}
                            onChange={(e) => setReturnDepAfter(Number(e.target.value))}
                            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                          >
                            {hours.map(h => (
                              <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">Later than</p>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Arrival</label>
                          <select
                            value={returnArrBefore}
                            onChange={(e) => setReturnArrBefore(Number(e.target.value))}
                            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                          >
                            {hours.map(h => (
                              <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">Earlier than</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={searching}
                  className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold rounded-lg shadow-lg transition-all"
                >
                  {searching ? '🌊 Navigating the Abyss...' : '🌊 Navigate the Abyss'}
                </button>
              </form>
            </div>
          </div>

          {/* MAIN CONTENT - Resultados */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800 rounded-lg shadow-xl p-6">
              
              {/* Error */}
              {error && (
                <div className="bg-red-900 border border-red-600 rounded-lg p-4 mb-6">
                  <p className="text-red-200">❌ {error}</p>
                </div>
              )}

              {/* Loading */}
              {searching && (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-cyan-500 mb-4"></div>
                  <p className="text-white text-xl">🌊 Nodens is navigating the abyss...</p>
                  <p className="text-gray-400 mt-2">Status: {searchStatus || 'starting'}</p>
                </div>
              )}

              {/* Results */}
              {!searching && results.length > 0 && (
                <div className="space-y-8">
                  <div className="text-center py-4">
                    <h2 className="text-3xl font-bold text-green-400">🌊 Nodens has brought order to the chaos!</h2>
                  </div>

                  {/* Best Overall */}
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-4">🏆 Best Overall Deals</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(getBestOverall()).map(([pattern, result]) => (
                        <div key={pattern} className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg p-4 shadow-lg">
                          <h4 className="text-lg font-bold text-white mb-2">✈️ {result.destination}</h4>
                          <p className="text-sm text-blue-100">{pattern}</p>
                          <p className="text-sm text-blue-100">📅 {result.outbound_date} → {result.return_date} ({result.days} days)</p>
                          <p className="text-2xl font-bold text-white my-2">💰 {result.total_price.toFixed(0)} EUR</p>
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block bg-white text-blue-600 px-4 py-2 rounded font-semibold hover:bg-blue-50 transition"
                          >
                            🔗 Ver en Kiwi.com
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* By Destination */}
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-4">📍 Best Deals by Destination</h3>
                    {Object.entries(groupResultsByDestination()).map(([destination, destResults]) => {
                      const sorted = destResults.sort((a, b) => a.total_price - b.total_price)
                      return (
                        <details key={destination} className="mb-3 bg-slate-700 rounded-lg">
                          <summary className="cursor-pointer p-4 font-semibold text-white hover:bg-slate-600 rounded-lg">
                            ✈️ {destination} - from {sorted[0].total_price.toFixed(0)} EUR
                          </summary>
                          <div className="p-4 space-y-2">
                            {sorted.map((result, idx) => (
                              <div key={idx} className="border-l-4 border-cyan-500 pl-3 py-2">
                                <p className="text-gray-300 font-medium">{result.pattern}</p>
                                <p className="text-gray-400 text-sm">📅 {result.outbound_date} → {result.return_date} ({result.days} days)</p>
                                <p className="text-white font-bold">💰 {result.total_price.toFixed(0)} EUR</p>
                                <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 text-sm">🔗 Ver vuelo</a>
                              </div>
                            ))}
                          </div>
                        </details>
                      )
                    })}
                  </div>

                  {/* By Pattern */}
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-4">📆 Best Deals by Pattern</h3>
                    {Object.entries(groupResultsByPattern()).map(([pattern, patternResults]) => {
                      const sorted = patternResults.sort((a, b) => a.total_price - b.total_price)
                      return (
                        <details key={pattern} className="mb-3 bg-slate-700 rounded-lg">
                          <summary className="cursor-pointer p-4 font-semibold text-white hover:bg-slate-600 rounded-lg">
                            🗓️ {pattern} - from {sorted[0].total_price.toFixed(0)} EUR
                          </summary>
                          <div className="p-4 space-y-2">
                            {sorted.map((result, idx) => (
                              <div key={idx} className="border-l-4 border-cyan-500 pl-3 py-2">
                                <p className="text-gray-300 font-medium">{result.destination}</p>
                                <p className="text-gray-400 text-sm">📅 {result.outbound_date} → {result.return_date} ({result.days} days)</p>
                                <p className="text-white font-bold">💰 {result.total_price.toFixed(0)} EUR</p>
                                <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 text-sm">🔗 Ver vuelo</a>
                              </div>
                            ))}
                          </div>
                        </details>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* No results yet */}
              {!searching && results.length === 0 && !error && (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-xl">Configure your search and navigate the abyss to find the best deals!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-slate-900 text-gray-400 text-center py-8 mt-12">
        <p className="text-lg">🌊 Nodens Navigator - Lord of the Great Abyss</p>
        <p className="italic mt-2">"From the depths of chaos, Nodens brings order and guides travelers home..."</p>
        <p className="text-sm mt-4">Inspired by H.P. Lovecraft's cosmic mythology</p>
      </div>
    </div>
  )
}
